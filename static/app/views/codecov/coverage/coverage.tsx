import styled from '@emotion/styled';

import {TreeCoverageSunburstChart} from 'sentry/components/charts/treeCoverageSunburstChart';
import {space} from 'sentry/styles/space';

const SAMPLE_DATA = {
  name: 'project-root',
  fullPath: 'project-root',
  coverage: 75, // Overall coverage percentage for the root directory
  children: [
    {
      name: 'src',
      fullPath: 'project-root/src',
      coverage: 82, // Coverage for the src directory
      children: [
        {
          name: 'components',
          fullPath: 'project-root/src/components',
          coverage: 90,
          children: [
            {
              name: 'Button.tsx',
              fullPath: 'project-root/src/components/Button.tsx',
              value: 1, // File nodes have a value of 1
              coverage: 95, // Coverage percentage for this file
              children: [],
            },
            {
              name: 'Input.tsx',
              fullPath: 'project-root/src/components/Input.tsx',
              value: 1,
              coverage: 85,
              children: [],
            },
          ],
        },
        {
          name: 'utils',
          fullPath: 'project-root/src/utils',
          coverage: 75,
          children: [
            {
              name: 'helpers.ts',
              fullPath: 'project-root/src/utils/helpers.ts',
              value: 1,
              coverage: 78,
              children: [],
            },
            {
              name: 'formatters.ts',
              fullPath: 'project-root/src/utils/formatters.ts',
              value: 1,
              coverage: 72,
              children: [],
            },
          ],
        },
      ],
    },
    {
      name: 'tests',
      fullPath: 'project-root/tests',
      coverage: 68,
      children: [
        {
          name: 'unit',
          fullPath: 'project-root/tests/unit',
          coverage: 68,
          children: [
            {
              name: 'test1.spec.ts',
              fullPath: 'project-root/tests/unit/test1.spec.ts',
              value: 1,
              coverage: 55,
              children: [],
            },
            {
              name: 'test2.spec.ts',
              fullPath: 'project-root/tests/unit/test2.spec.ts',
              value: 1,
              coverage: 81,
              children: [],
            },
          ],
        },
      ],
    },
  ],
};

export default function CoveragePage() {
  return (
    <LayoutGap>
      <p>Coverage Analytics</p>
      <TreeCoverageSunburstChart data={SAMPLE_DATA} />
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
