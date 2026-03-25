import { Command } from 'commander';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import { resolveGlob, ensureAbsolute } from '../utils/glob';

export const videoCommand = new Command('video')
  .description('Video manipulation commands')
  .addCommand(extractFramesCommand())
  .addCommand(convertVideoCommand())
  .addCommand(trimCommand())
  .addCommand(thumbnailCommand())
  .addCommand(resizeVideoCommand())
  .addCommand(extractAudioCommand());

function outputPath(input: string, suffix: string, ext?: string): string {
  const parsed = path.parse(input);
  const outExt = ext ?? parsed.ext;
  return path.join(parsed.dir, `${parsed.name}${suffix}${outExt}`);
}

function runFfmpeg(cmd: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    cmd
      .on('error', reject)
      .on('end', () => resolve())
      .run();
  });
}

function extractFramesCommand(): Command {
  return new Command('extract-frames')
    .description('Extract frames from video as images')
    .argument('<input>', 'Input video file')
    .option('-r, --fps <fps>', 'Frames per second to extract (default: 1)', parseFloat)
    .option('--output-dir <dir>', 'Output directory (default: <input>-frames/)')
    .option('-f, --format <format>', 'Output image format (default: png)', 'png')
    .action(async (input: string, opts: { fps?: number; outputDir?: string; format: string }) => {
      const absFile = ensureAbsolute(input);
      const fps = opts.fps ?? 1;
      const outDir = opts.outputDir ?? outputPath(absFile, '-frames', '');
      fs.mkdirSync(outDir, { recursive: true });

      const pattern = path.join(outDir, `frame-%04d.${opts.format}`);
      const cmd = ffmpeg.default(absFile)
        .outputOptions([`-vf fps=${fps}`])
        .output(pattern);

      try {
        await runFfmpeg(cmd);
        console.log(`extract-frames: ${input} -> ${outDir}/`);
      } catch (err) {
        console.error(`extract-frames failed:`, err);
        process.exit(1);
      }
    });
}

function convertVideoCommand(): Command {
  return new Command('convert')
    .description('Convert video format')
    .argument('<input>', 'Input video file or glob pattern')
    .requiredOption('-f, --format <format>', 'Output format (mp4, mov, avi, mkv, webm, gif)')
    .option('-o, --output <file>', 'Output file (single input only)')
    .option('--output-dir <dir>', 'Output directory for batch processing')
    .action(async (input: string, opts: { format: string; output?: string; outputDir?: string }) => {
      const files = await resolveGlob(input);
      if (files.length === 0) { console.error(`No files matched: ${input}`); process.exit(1); }

      for (const file of files) {
        const absFile = ensureAbsolute(file);
        let outFile: string;
        if (opts.output && files.length === 1) {
          outFile = opts.output;
        } else if (opts.outputDir) {
          fs.mkdirSync(opts.outputDir, { recursive: true });
          const basename = path.basename(absFile, path.extname(absFile));
          outFile = path.join(opts.outputDir, `${basename}.${opts.format}`);
        } else {
          outFile = outputPath(absFile, '', `.${opts.format}`);
        }

        try {
          const cmd = ffmpeg.default(absFile).output(outFile);
          await runFfmpeg(cmd);
          console.log(`video convert: ${file} -> ${outFile}`);
        } catch (err) {
          console.error(`video convert failed for ${file}:`, err);
          process.exit(1);
        }
      }
    });
}

function trimCommand(): Command {
  return new Command('trim')
    .description('Trim video to a specific time range')
    .argument('<input>', 'Input video file')
    .requiredOption('-s, --start <time>', 'Start time (e.g. 00:00:10 or 10)')
    .requiredOption('-e, --end <time>', 'End time (e.g. 00:00:30 or 30)')
    .option('-o, --output <file>', 'Output file')
    .action(async (input: string, opts: { start: string; end: string; output?: string }) => {
      const absFile = ensureAbsolute(input);
      const outFile = opts.output ?? outputPath(absFile, '-trimmed');

      try {
        const cmd = ffmpeg.default(absFile)
          .setStartTime(opts.start)
          .outputOptions([`-to ${opts.end}`])
          .output(outFile);
        await runFfmpeg(cmd);
        console.log(`trim: ${input} -> ${outFile}`);
      } catch (err) {
        console.error(`trim failed:`, err);
        process.exit(1);
      }
    });
}

function thumbnailCommand(): Command {
  return new Command('thumbnail')
    .description('Extract a thumbnail from a video')
    .argument('<input>', 'Input video file')
    .option('-t, --time <seconds>', 'Timestamp to extract thumbnail (default: 1)', parseFloat)
    .option('-o, --output <file>', 'Output image file')
    .option('-f, --format <format>', 'Output image format (default: jpg)', 'jpg')
    .option('-w, --width <px>', 'Thumbnail width', parseInt)
    .action(async (input: string, opts: { time?: number; output?: string; format: string; width?: number }) => {
      const absFile = ensureAbsolute(input);
      const time = opts.time ?? 1;
      const outFile = opts.output ?? outputPath(absFile, '-thumbnail', `.${opts.format}`);
      const outDir = path.dirname(outFile);
      fs.mkdirSync(outDir, { recursive: true });

      return new Promise<void>((resolve, reject) => {
        const thumbnailOpts: ffmpeg.ScreenshotsConfig = {
          timestamps: [time],
          filename: path.basename(outFile),
          folder: outDir,
        };
        if (opts.width) thumbnailOpts.size = `${opts.width}x?`;

        ffmpeg.default(absFile)
          .screenshots(thumbnailOpts)
          .on('end', () => {
            console.log(`thumbnail: ${input} -> ${outFile}`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`thumbnail failed:`, err);
            process.exit(1);
          });
      });
    });
}

function resizeVideoCommand(): Command {
  return new Command('resize')
    .description('Resize video')
    .argument('<input>', 'Input video file or glob pattern')
    .option('-w, --width <px>', 'Width (use -1 to auto-scale)', parseInt)
    .option('-h, --height <px>', 'Height (use -1 to auto-scale)', parseInt)
    .option('-o, --output <file>', 'Output file (single input only)')
    .option('--output-dir <dir>', 'Output directory for batch processing')
    .action(async (input: string, opts: { width?: number; height?: number; output?: string; outputDir?: string }) => {
      if (!opts.width && !opts.height) {
        console.error('Provide at least --width or --height');
        process.exit(1);
      }
      const files = await resolveGlob(input);
      if (files.length === 0) { console.error(`No files matched: ${input}`); process.exit(1); }

      const w = opts.width ?? -1;
      const h = opts.height ?? -1;
      const scale = `scale=${w}:${h}`;

      for (const file of files) {
        const absFile = ensureAbsolute(file);
        let outFile: string;
        if (opts.output && files.length === 1) {
          outFile = opts.output;
        } else if (opts.outputDir) {
          fs.mkdirSync(opts.outputDir, { recursive: true });
          outFile = path.join(opts.outputDir, path.basename(absFile));
        } else {
          const suffix = opts.width ? `-${opts.width}w` : `-${opts.height}h`;
          outFile = outputPath(absFile, suffix);
        }

        try {
          const cmd = ffmpeg.default(absFile)
            .videoFilter(scale)
            .output(outFile);
          await runFfmpeg(cmd);
          console.log(`video resize: ${file} -> ${outFile}`);
        } catch (err) {
          console.error(`video resize failed for ${file}:`, err);
          process.exit(1);
        }
      }
    });
}

function extractAudioCommand(): Command {
  return new Command('extract-audio')
    .description('Extract audio track from video')
    .argument('<input>', 'Input video file or glob pattern')
    .option('-f, --format <format>', 'Output audio format (default: mp3)', 'mp3')
    .option('-o, --output <file>', 'Output file (single input only)')
    .option('--output-dir <dir>', 'Output directory for batch processing')
    .action(async (input: string, opts: { format: string; output?: string; outputDir?: string }) => {
      const files = await resolveGlob(input);
      if (files.length === 0) { console.error(`No files matched: ${input}`); process.exit(1); }

      for (const file of files) {
        const absFile = ensureAbsolute(file);
        let outFile: string;
        if (opts.output && files.length === 1) {
          outFile = opts.output;
        } else if (opts.outputDir) {
          fs.mkdirSync(opts.outputDir, { recursive: true });
          const basename = path.basename(absFile, path.extname(absFile));
          outFile = path.join(opts.outputDir, `${basename}.${opts.format}`);
        } else {
          outFile = outputPath(absFile, '-audio', `.${opts.format}`);
        }

        try {
          const cmd = ffmpeg.default(absFile)
            .noVideo()
            .output(outFile);
          await runFfmpeg(cmd);
          console.log(`extract-audio: ${file} -> ${outFile}`);
        } catch (err) {
          console.error(`extract-audio failed for ${file}:`, err);
          process.exit(1);
        }
      }
    });
}
