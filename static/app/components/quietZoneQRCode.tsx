import type React from 'react';
import styled from '@emotion/styled';
import {QRCodeCanvas} from 'qrcode.react';

interface QuietZoneQRCodeProps
  extends Omit<
    React.ComponentProps<typeof QRCodeCanvas>,
    'bgColor' | 'fgColor' | 'includeMargin'
  > {
  /**
   * The size of the QR code in pixels
   */
  size: number;
  /**
   * The value to encode in the QR code
   */
  value: string;
}

/**
 * QR code component with proper quiet zone for reliable scanning.
 *
 * Implements QR code specification requirements:
 * - White background for maximum contrast
 * - Black foreground pattern
 * - 4X wide quiet zone (white margin) on all sides
 *
 * The white background is maintained regardless of theme to ensure
 * QR codes remain scannable in both light and dark modes.
 */
export function QuietZoneQRCode({size, value, ...props}: QuietZoneQRCodeProps) {
  return (
    <Wrapper>
      <StyledQRCodeCanvas
        {...props}
        size={size}
        value={value}
        bgColor="#FFFFFF"
        fgColor="#000000"
        includeMargin
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.border};
  display: inline-block;
  overflow: hidden;
`;

const StyledQRCodeCanvas = styled(QRCodeCanvas)`
  display: block;
`;
