import { Command } from 'commander';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { resolveGlob, ensureAbsolute } from '../utils/glob';

export const imageCommand = new Command('image')
  .description('Image manipulation commands')
  .addCommand(removeBgCommand())
  .addCommand(convertCommand())
  .addCommand(resizeCommand())
  .addCommand(compressCommand())
  .addCommand(cropCommand())
  .addCommand(rotateCommand())
  .addCommand(flipCommand());

function outputPath(input: string, suffix: string, ext?: string): string {
  const parsed = path.parse(input);
  const outExt = ext ?? parsed.ext;
  return path.join(parsed.dir, `${parsed.name}${suffix}${outExt}`);
}

function removeBgCommand(): Command {
  return new Command('remove-bg')
    .description('Remove background from image(s)')
    .argument('<input>', 'Input file or glob pattern')
    .option('-o, --output <file>', 'Output file (single input only)')
    .option('--output-dir <dir>', 'Output directory for batch processing')
    .action(async (input: string, opts: { output?: string; outputDir?: string }) => {
      const files = await resolveGlob(input);
      if (files.length === 0) {
        console.error(`No files matched: ${input}`);
        process.exit(1);
      }

      // Dynamically import ESM-only module
      const { removeBackground } = await import('@imgly/background-removal-node');

      for (const file of files) {
        const absFile = ensureAbsolute(file);
        let outFile: string;
        if (opts.output && files.length === 1) {
          outFile = opts.output;
        } else if (opts.outputDir) {
          const basename = path.basename(absFile, path.extname(absFile));
          outFile = path.join(opts.outputDir, `${basename}-no-bg.png`);
          fs.mkdirSync(opts.outputDir, { recursive: true });
        } else {
          outFile = outputPath(absFile, '-no-bg', '.png');
        }

        try {
          const imageBuffer = fs.readFileSync(absFile);
          const blob = new Blob([imageBuffer]);
          const resultBlob = await removeBackground(blob);
          const arrayBuffer = await resultBlob.arrayBuffer();
          fs.writeFileSync(outFile, Buffer.from(arrayBuffer));
          console.log(`remove-bg: ${file} -> ${outFile}`);
        } catch (err) {
          console.error(`remove-bg failed for ${file}:`, err);
          process.exit(1);
        }
      }
    });
}

function convertCommand(): Command {
  return new Command('convert')
    .description('Convert image format')
    .argument('<input>', 'Input file or glob pattern')
    .requiredOption('-f, --format <format>', 'Output format (jpeg, png, webp, avif, tiff, gif)')
    .option('-o, --output <file>', 'Output file (single input only)')
    .option('--output-dir <dir>', 'Output directory for batch processing')
    .action(async (input: string, opts: { format: string; output?: string; outputDir?: string }) => {
      const files = await resolveGlob(input);
      if (files.length === 0) { console.error(`No files matched: ${input}`); process.exit(1); }

      const formatMap: Record<string, string> = {
        jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp',
        avif: 'avif', tiff: 'tiff', gif: 'gif'
      };
      const fmt = formatMap[opts.format.toLowerCase()];
      if (!fmt) {
        console.error(`Unsupported format: ${opts.format}. Use: jpeg, png, webp, avif, tiff, gif`);
        process.exit(1);
      }

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
          await (sharp(absFile) as any)[fmt]().toFile(outFile);
          console.log(`convert: ${file} -> ${outFile}`);
        } catch (err) {
          console.error(`convert failed for ${file}:`, err);
          process.exit(1);
        }
      }
    });
}

function resizeCommand(): Command {
  return new Command('resize')
    .description('Resize image(s)')
    .argument('<input>', 'Input file or glob pattern')
    .option('-w, --width <px>', 'Width in pixels', parseInt)
    .option('-h, --height <px>', 'Height in pixels', parseInt)
    .option('--fit <fit>', 'Fit mode: cover, contain, fill, inside, outside (default: inside)', 'inside')
    .option('-o, --output <file>', 'Output file (single input only)')
    .option('--output-dir <dir>', 'Output directory for batch processing')
    .action(async (input: string, opts: { width?: number; height?: number; fit: string; output?: string; outputDir?: string }) => {
      if (!opts.width && !opts.height) {
        console.error('Provide at least --width or --height');
        process.exit(1);
      }
      const files = await resolveGlob(input);
      if (files.length === 0) { console.error(`No files matched: ${input}`); process.exit(1); }

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
          await sharp(absFile)
            .resize(opts.width ?? null, opts.height ?? null, { fit: opts.fit as any })
            .toFile(outFile);
          console.log(`resize: ${file} -> ${outFile}`);
        } catch (err) {
          console.error(`resize failed for ${file}:`, err);
          process.exit(1);
        }
      }
    });
}

function compressCommand(): Command {
  return new Command('compress')
    .description('Compress image(s)')
    .argument('<input>', 'Input file or glob pattern')
    .option('-q, --quality <0-100>', 'Quality (default: 80)', parseInt)
    .option('-o, --output <file>', 'Output file (single input only)')
    .option('--output-dir <dir>', 'Output directory for batch processing')
    .action(async (input: string, opts: { quality?: number; output?: string; outputDir?: string }) => {
      const quality = opts.quality ?? 80;
      const files = await resolveGlob(input);
      if (files.length === 0) { console.error(`No files matched: ${input}`); process.exit(1); }

      for (const file of files) {
        const absFile = ensureAbsolute(file);
        let outFile: string;
        if (opts.output && files.length === 1) {
          outFile = opts.output;
        } else if (opts.outputDir) {
          fs.mkdirSync(opts.outputDir, { recursive: true });
          outFile = path.join(opts.outputDir, path.basename(absFile));
        } else {
          outFile = outputPath(absFile, '-compressed');
        }

        try {
          const ext = path.extname(absFile).toLowerCase().replace('.', '');
          let img = sharp(absFile);
          if (ext === 'jpg' || ext === 'jpeg') img = img.jpeg({ quality });
          else if (ext === 'png') img = img.png({ quality });
          else if (ext === 'webp') img = img.webp({ quality });
          else img = img.jpeg({ quality }); // fallback
          await img.toFile(outFile);
          console.log(`compress: ${file} -> ${outFile}`);
        } catch (err) {
          console.error(`compress failed for ${file}:`, err);
          process.exit(1);
        }
      }
    });
}

function cropCommand(): Command {
  return new Command('crop')
    .description('Crop image(s)')
    .argument('<input>', 'Input file or glob pattern')
    .requiredOption('--left <px>', 'Left offset in pixels', parseInt)
    .requiredOption('--top <px>', 'Top offset in pixels', parseInt)
    .requiredOption('--width <px>', 'Crop width in pixels', parseInt)
    .requiredOption('--height <px>', 'Crop height in pixels', parseInt)
    .option('-o, --output <file>', 'Output file (single input only)')
    .option('--output-dir <dir>', 'Output directory for batch processing')
    .action(async (input: string, opts: { left: number; top: number; width: number; height: number; output?: string; outputDir?: string }) => {
      const files = await resolveGlob(input);
      if (files.length === 0) { console.error(`No files matched: ${input}`); process.exit(1); }

      for (const file of files) {
        const absFile = ensureAbsolute(file);
        let outFile: string;
        if (opts.output && files.length === 1) {
          outFile = opts.output;
        } else if (opts.outputDir) {
          fs.mkdirSync(opts.outputDir, { recursive: true });
          outFile = path.join(opts.outputDir, path.basename(absFile));
        } else {
          outFile = outputPath(absFile, '-cropped');
        }

        try {
          await sharp(absFile)
            .extract({ left: opts.left, top: opts.top, width: opts.width, height: opts.height })
            .toFile(outFile);
          console.log(`crop: ${file} -> ${outFile}`);
        } catch (err) {
          console.error(`crop failed for ${file}:`, err);
          process.exit(1);
        }
      }
    });
}

function rotateCommand(): Command {
  return new Command('rotate')
    .description('Rotate image(s)')
    .argument('<input>', 'Input file or glob pattern')
    .requiredOption('-a, --angle <degrees>', 'Rotation angle in degrees', parseFloat)
    .option('-o, --output <file>', 'Output file (single input only)')
    .option('--output-dir <dir>', 'Output directory for batch processing')
    .action(async (input: string, opts: { angle: number; output?: string; outputDir?: string }) => {
      const files = await resolveGlob(input);
      if (files.length === 0) { console.error(`No files matched: ${input}`); process.exit(1); }

      for (const file of files) {
        const absFile = ensureAbsolute(file);
        let outFile: string;
        if (opts.output && files.length === 1) {
          outFile = opts.output;
        } else if (opts.outputDir) {
          fs.mkdirSync(opts.outputDir, { recursive: true });
          outFile = path.join(opts.outputDir, path.basename(absFile));
        } else {
          outFile = outputPath(absFile, `-rot${opts.angle}`);
        }

        try {
          await sharp(absFile).rotate(opts.angle).toFile(outFile);
          console.log(`rotate: ${file} -> ${outFile}`);
        } catch (err) {
          console.error(`rotate failed for ${file}:`, err);
          process.exit(1);
        }
      }
    });
}

function flipCommand(): Command {
  return new Command('flip')
    .description('Flip image(s) horizontally or vertically')
    .argument('<input>', 'Input file or glob pattern')
    .option('--horizontal', 'Flip horizontally (mirror)')
    .option('--vertical', 'Flip vertically')
    .option('-o, --output <file>', 'Output file (single input only)')
    .option('--output-dir <dir>', 'Output directory for batch processing')
    .action(async (input: string, opts: { horizontal?: boolean; vertical?: boolean; output?: string; outputDir?: string }) => {
      if (!opts.horizontal && !opts.vertical) {
        console.error('Specify --horizontal and/or --vertical');
        process.exit(1);
      }
      const files = await resolveGlob(input);
      if (files.length === 0) { console.error(`No files matched: ${input}`); process.exit(1); }

      for (const file of files) {
        const absFile = ensureAbsolute(file);
        let outFile: string;
        if (opts.output && files.length === 1) {
          outFile = opts.output;
        } else if (opts.outputDir) {
          fs.mkdirSync(opts.outputDir, { recursive: true });
          outFile = path.join(opts.outputDir, path.basename(absFile));
        } else {
          const suffix = opts.horizontal && opts.vertical ? '-flipboth' : opts.horizontal ? '-fliph' : '-flipv';
          outFile = outputPath(absFile, suffix);
        }

        try {
          let img = sharp(absFile);
          if (opts.horizontal) img = img.flop();
          if (opts.vertical) img = img.flip();
          await img.toFile(outFile);
          console.log(`flip: ${file} -> ${outFile}`);
        } catch (err) {
          console.error(`flip failed for ${file}:`, err);
          process.exit(1);
        }
      }
    });
}
