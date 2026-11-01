type CloudDividerProps = {
  fill: string;
  flip?: boolean;
};

export default function CloudDivider({ fill, flip }: CloudDividerProps) {
  return (
    <svg
      viewBox="0 0 1440 110"
      preserveAspectRatio="none"
      style={{
        width: "100%",
        height: 90,
        display: "block",
        transform: flip ? "scaleY(-1)" : undefined,
      }}
    >
      <path
        d="M0,40 C120,90 240,0 360,35 C480,70 600,10 720,40 C840,70 960,5 1080,35 C1200,65 1320,15 1440,45 L1440,110 L0,110 Z"
        fill={fill}
      />
    </svg>
  );
}
