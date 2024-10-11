#!/usr/bin/osascript

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title VideoTimestamp
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🕒

# Documentation:
# @raycast.description 获取视频时间戳并粘贴
# @raycast.author LeftLeft
# @raycast.authorURL https://raycast.com/LeftLeft

on run
    -- 模拟按下 Command + Shift + G
    tell application "System Events"
        keystroke "g" using {command down, shift down}
    end tell
    
    -- 等待一小段时间，确保快捷键已被处理和内容已被复制到剪贴板
    delay 0.5
    
    -- 直接执行粘贴操作，不进行复杂的检查
    tell application "System Events"
        keystroke "v" using command down
    end tell
    
    return "操作完成，请检查时间戳是否已粘贴到目标位置"
end run

