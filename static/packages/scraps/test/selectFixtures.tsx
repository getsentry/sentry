import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';

import {Text} from '@sentry/scraps/text';

import {lightTheme} from '../src/theme';

export const options = [
  {value: 'apple', label: 'Apple', details: 'Fruit'},
  {value: 'cherry', label: 'Cherry', details: 'Fruit'},
];

export function FruitValue({option}: {option: (typeof options)[number]}) {
  return <Text>Selected {option.label}</Text>;
}

export function FruitOptionLabel({option}: {option: (typeof options)[number]}) {
  return <Text>Choose {option.label}</Text>;
}

export function FruitMultiValueLabel({
  option,
  children,
}: {
  children: React.ReactNode;
  option: (typeof options)[number];
}) {
  return (
    <Text>
      {children}: {option.details}
    </Text>
  );
}

export function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}
