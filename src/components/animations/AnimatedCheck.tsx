import React from 'react';

interface AnimatedCheckProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
  color?: string;
}

export const AnimatedCheck: React.FC<AnimatedCheckProps> = ({
  size = 20,
  className = '',
  strokeWidth = 3,
  color = 'currentColor',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M20 6L9 17l-5-5"
        className="animate-stroke-draw"
      />
    </svg>
  );
};
