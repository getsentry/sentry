import {css} from '@emotion/react';
import type {Theme} from '@emotion/react';

// String values should NOT be transformed
const colorNames = {
  primary: 'gray100',
  secondary: 'gray200',
  tertiary: 'gray300',
};

// CSS class names should NOT be transformed
const className = 'gray100';
const classString = `text-gray200 bg-gray300`;

// Non-theme gray references should NOT be transformed
const customGrayObj = {
  gray100: '#f0f0f0',
  gray200: '#e0e0e0',
};

const value = customGrayObj.gray100;
const another = customGrayObj.gray200;

// Object property names should NOT be transformed
const config = {
  gray100: '#fff',
  gray200: '#eee',
  colors: {
    gray300: '#ddd',
  },
};

// Already migrated colors should NOT be transformed
const correct = (theme: Theme) => css`
  color: ${theme.colors.gray100};
  background: ${theme.colors.gray200};
`;

// Comments mentioning colors should remain unchanged
// Use theme.gray100 for the background
// theme.gray200 is deprecated
const commented = 'gray300';
