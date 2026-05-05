declare module 'save-svg-as-png' {
  export function saveSvgAsPng(
    element: SVGElement,
    filename: string,
    options?: {
      scale?: number;
      backgroundColor?: string;
      encoderOptions?: number;
    }
  ): Promise<void>;

  export function svgAsPngUri(
    element: SVGElement,
    options?: { scale?: number; backgroundColor?: string }
  ): Promise<string>;
}
