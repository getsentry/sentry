import type {ReactNode} from 'react';

export function isRenderable(node: ReactNode) {
  return node != null && typeof node !== 'boolean';
}
