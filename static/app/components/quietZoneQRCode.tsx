import styled from '@emotion/styled';
import type {QRCodeCanvasProps} from 'qrcode.react';
import {QRCodeCanvas} from 'qrcode.react';

import {space} from 'sentry/styles/space';

interface QuietZoneQRCodeProps
  extends Omit<QRCodeCanvasProps, 'bgColor' | 'fgColor' | 'marginSize'> {
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
        size={size}
        value={value}
        bgColor="#FFFFFF"
        fgColor="#000000"
        marginSize={4}
        {...props}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  background: #ffffff;
  padding: ${space(2)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  display: inline-block;
`;

const StyledQRCodeCanvas = styled(QRCodeCanvas)`
  display: block;
`;
