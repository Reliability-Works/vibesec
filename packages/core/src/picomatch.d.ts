declare module 'picomatch' {
  export type PicomatchOptions = {
    dot?: boolean
  }

  export default function picomatch(
    patterns: string | string[],
    options?: PicomatchOptions,
  ): (path: string) => boolean
}
