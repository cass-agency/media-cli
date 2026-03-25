# media-cli

All-in-one CLI tool for image and video manipulation. AI agent and developer friendly — clean non-interactive output, stdin/stdout support.

## Install

```bash
npm install -g media-cli
```

Requires `ffmpeg` in PATH for video commands.

## Usage

```bash
media-cli --help
media-cli image --help
media-cli video --help
```

## Image Commands

### remove-bg
Remove background from image(s).
```bash
media-cli image remove-bg photo.jpg
media-cli image remove-bg photo.jpg --output photo-nobg.png
media-cli image remove-bg "*.jpg" --output-dir ./nobg/
```

### convert
Convert image format.
```bash
media-cli image convert photo.jpg --format png
media-cli image convert photo.jpg --format webp --output photo.webp
media-cli image convert "*.png" --format jpg
```

### resize
Resize image(s).
```bash
media-cli image resize photo.jpg --width 800
media-cli image resize photo.jpg --width 800 --height 600
media-cli image resize "*.jpg" --width 1920
```

### compress
Compress image(s).
```bash
media-cli image compress photo.jpg --quality 80
media-cli image compress "*.jpg" --quality 70
```

### crop
Crop image.
```bash
media-cli image crop photo.jpg --left 0 --top 0 --width 400 --height 300
media-cli image crop photo.jpg --left 100 --top 50 --width 400 --height 300
```

### rotate
Rotate image.
```bash
media-cli image rotate photo.jpg --angle 90
media-cli image rotate photo.jpg --angle 180 --output rotated.jpg
```

### flip
Flip image horizontally or vertically.
```bash
media-cli image flip photo.jpg --horizontal
media-cli image flip photo.jpg --vertical
```

## Video Commands

Requires `ffmpeg` installed and available in PATH.

### extract-frames
Extract frames from video as images.
```bash
media-cli video extract-frames video.mp4 --output-dir ./frames/
media-cli video extract-frames video.mp4 --output-dir ./frames/ --fps 1
```

### convert
Convert video format.
```bash
media-cli video convert video.mp4 --format avi
media-cli video convert video.mp4 --format webm --output video.webm
```

### trim
Trim video by start/end time.
```bash
media-cli video trim video.mp4 --start 00:00:10 --end 00:00:30
media-cli video trim video.mp4 --start 10 --end 30 --output clip.mp4
```

### thumbnail
Extract thumbnail from video.
```bash
media-cli video thumbnail video.mp4
media-cli video thumbnail video.mp4 --time 5 --output thumb.jpg
```

### resize
Resize video.
```bash
media-cli video resize video.mp4 --width 1280
media-cli video resize video.mp4 --width 1280 --height 720 --output resized.mp4
```

### extract-audio
Extract audio track from video.
```bash
media-cli video extract-audio video.mp4
media-cli video extract-audio video.mp4 --format mp3 --output audio.mp3
```

## Glob Patterns

All image commands support glob patterns for batch processing:
```bash
media-cli image resize "*.jpg" --width 800
media-cli image convert "photos/*.png" --format webp
media-cli image compress "**/*.jpg" --quality 75
```

## License

MIT — Cass Agency
