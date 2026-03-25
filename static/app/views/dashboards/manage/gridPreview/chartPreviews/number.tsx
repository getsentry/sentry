interface NumberPreviewProps {
  color: string;
}

export function NumberPreview({color}: NumberPreviewProps) {
  return (
    <svg
      viewBox="0 0 70 17"
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      preserveAspectRatio="none"
      height="100%"
      width="100%"
    >
      <rect width="50" height="16" rx="1" />
    </svg>
  );
}
