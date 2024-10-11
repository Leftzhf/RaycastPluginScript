#!/usr/bin/env node

// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title copyImageBase64
// @raycast.mode silent

// Optional parameters:
// @raycast.icon 🖼️

// Documentation:
// @raycast.author LeftLeft
// @raycast.authorURL https://raycast.com/LeftLeft

const { exec, execFile } = require("child_process");
const { promisify } = require("util");
const fs = require('fs').promises;
const iconv = require('iconv-lite');

const execFileAsync = promisify(execFile);

// 模拟按下 Command + Shift + B
async function simulateKeyPress(retries = 3, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const script = `
        osascript -e '
          tell application "System Events"
            keystroke "b" using {command down, shift down}
          end tell
        '
      `;
      
      await new Promise((resolve, reject) => {
        exec(script, (error, stdout, stderr) => {
          if (error) {
            console.error(`模拟按键失败（尝试 ${i + 1}/${retries}）:`, error);
            console.error("错误输出:", stderr);
            reject(error);
          } else {
            console.log(`模拟按键成功（尝试 ${i + 1}/${retries}）`);
            resolve();
          }
        });
      });

      // 等待一段时间让剪贴板更新
      await new Promise(resolve => setTimeout(resolve, 1000));

      const clipboardContent = await getClipboardContent(1, 0);
      
      if (clipboardContent) {
        console.log("成功获取剪贴板内容");
        return clipboardContent; // 返回剪贴板内容
      }
      
      console.log(`未能获取剪贴板内容，准备重试（尝试 ${i + 1}/${retries}）`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
  throw new Error("模拟按键失败，无法获取剪贴板内容");
}

// 获取剪贴板内容
async function getClipboardContent(retries = 3, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const { stdout } = await execFileAsync('pbpaste', [], { encoding: 'buffer', maxBuffer: 100 * 1024 * 1024 });
      const content = stdout.toString('utf8').trim();
      if (content.length > 0) {
        console.log(`成功获取剪贴板内容（尝试 ${i + 1}/${retries}）`);
        return content;
      }
      console.log(`剪贴板内容为空，等待后重试（尝试 ${i + 1}/${retries}）`);
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.error(`获取剪贴板内容失败（尝试 ${i + 1}/${retries}）:`, error);
      if (i === retries - 1) throw error;
    }
  }
  console.error("剪贴板内容为空，已达到最大重试次数");
  return null;
}

// 修改 isCompleteDataURL 函数
function isCompleteDataURL(str) {
  const dataURLRegex = /^data:image\/\w+;base64,/;
  return dataURLRegex.test(str);
}

// 修改 completeDataURL 函数
function completeDataURL(str) {
  if (isCompleteDataURL(str)) {
    return str;
  }
  // 检查是否是有效的 base64 字符串
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  if (base64Regex.test(str)) {
    return `data:image/png;base64,${str}`;
  }
  return null; // 如果既不是完整的 Data URL，也不是有效的 base64 字符串，返回 null
}

// 修改 copyDataURLToClipboard 函数
async function copyDataURLToClipboard(dataURL) {
  const base64Data = dataURL.split(',')[1];
  const tempFilePath = `/tmp/temp_image_${Date.now()}.png`;
  const tempBase64FilePath = `${tempFilePath}.base64`;
  
  try {
    // 将Base64数据写入临时文件
    await fs.writeFile(tempBase64FilePath, base64Data);
    
    // 使用base64命令解码数据并保存为图片
    try {
      await execFileAsync('base64', ['-d', '-i', tempBase64FilePath, '-o', tempFilePath]);
    } catch (decodeError) {
      console.error("Base64 解码失败:", decodeError);
      throw new Error("无效的 Base64 数据");
    }
    
    // 检查生成的文件是否为有效的图片
    try {
      await execFileAsync('file', ['-b', '--mime-type', tempFilePath]);
    } catch (fileTypeError) {
      console.error("生成的文件不是有效的图片:", fileTypeError);
      throw new Error("生成的文件不是有效的图片");
    }
    
    // 使用osascript将图片复制到剪贴板
    const script = `
      osascript -e '
        set imageFile to POSIX file "${tempFilePath}"
        set the clipboard to (read imageFile as «class PNGf»)
      '
    `;
    
    await execFileAsync('/bin/bash', ['-c', script]);
    
    console.log("成功复制图片到剪贴板");
  } catch (error) {
    console.error("复制图片到剪贴板失败:", error);
    throw error;
  } finally {
    // 清理临时文件
    try {
      await fs.unlink(tempFilePath).catch(() => {});
      await fs.unlink(tempBase64FilePath).catch(() => {});
    } catch (error) {
      console.error("删除临时文件失败:", error);
    }
  }
}

// 修改 tryPaste 函数
async function tryPaste() {
  const script = `
    osascript -e '
      tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
        tell process frontApp
          set frontmost to true
          delay 0.5
          keystroke "v" using {command down}
          delay 0.5
        end tell
      end tell
      
      -- 尝试获取剪贴板内容类型
      set clipboardInfo to (the clipboard info for (the clipboard))
      if clipboardInfo contains "«class PNGf»" then
        return "Image pasted successfully"
      else
        return "Paste operation may have failed"
      end if
    '
  `;

  return new Promise((resolve, reject) => {
    exec(script, (error, stdout, stderr) => {
      if (error) {
        console.error("粘贴操作失败:", error);
        console.error("错误输出:", stderr);
        reject(error);
      } else {
        console.log("粘贴操作执行结果:", stdout.trim());
        resolve(stdout.trim());
      }
    });
  });
}

// 修改 main 函数
async function main() {
  try {
    console.log("开始执行脚本");

    // 模拟按键并获取剪贴板内容
    const clipboardContent = await simulateKeyPress(5, 1000); // 5次重试，每次间隔1秒

    if (!clipboardContent) {
      console.log("无法获取剪贴板内容，请检查复制操作是否成功");
      return;
    }

    const completeDataURLString = completeDataURL(clipboardContent);
    
    if (completeDataURLString) {
      console.log("检测到有效的 Data URL 格式或 Base64 数据");
      try {
        await copyDataURLToClipboard(completeDataURLString);
        console.log("Data URL 已作为图片复制到剪贴板");

        // 尝试粘贴
        try {
          const pasteResult = await tryPaste();
          if (pasteResult === "Image pasted successfully") {
            console.log("图片已成功粘贴到当前焦点位置");
          } else {
            console.log("图片粘贴可能失败，请手动检查");
          }
        } catch (pasteError) {
          console.log("无法粘贴到当前位置，可能是焦点不在可粘贴区域");
        }
      } catch (copyError) {
        console.error("复制图片到剪贴板失败:", copyError.message);
      }
    } else {
      console.log("剪贴板内容不是有效的 Data URL 或 Base64 数据");
      console.log("剪贴板内容前100个字符:", clipboardContent.substring(0, 100));
    }
  } catch (error) {
    console.error("发生错误:", error.message);
  }
}

main();