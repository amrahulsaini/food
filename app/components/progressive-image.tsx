"use client";

import { type ImgHTMLAttributes, useState } from "react";

type ProgressiveImageProps = ImgHTMLAttributes<HTMLImageElement>;

export default function ProgressiveImage({
  className = "",
  loading,
  decoding,
  onLoad,
  ...rest
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      {...rest}
      loading={loading ?? "lazy"}
      decoding={decoding ?? "async"}
      className={`${className} progressive-image ${loaded ? "progressive-image-loaded" : ""}`.trim()}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
    />
  );
}