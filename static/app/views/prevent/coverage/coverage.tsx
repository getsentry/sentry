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

// The GHConnectionPrerequisites component was originally added for the TA side but
// is no longer needed there. This may be useful for coverage though so keeping it here for now.

// function GHConnectionPrerequisites() {
//   return (
//     <PrerequisitesSection>
//       <PrerequisitesTitle>
//         {t('Prerequisites to connect your GitHub organization:')}
//       </PrerequisitesTitle>
//       <Prerequisites>
//         <Prereq>
//           <PrereqMainText>{t('Enable GitHub as an Auth Provider')}</PrereqMainText>
//           <PrereqSubText>
//             {t(
//               "Sentry Prevent analyzes your code through your Git provider. You'll need to authenticate to access data from your organizations."
//             )}
//           </PrereqSubText>
//         </Prereq>
//         <Prereq>
//           <PrereqMainText>{t('Install the GitHub Sentry App')}</PrereqMainText>
//           <PrereqSubText>
//             <Link to="https://github.com/apps/sentry">{t('Install the app')}</Link>
//             {t(
//               " on your GitHub org in your Sentry org. You will need to be an Owner of your GitHub organization to fully configure the integration. Note: Once linked, a GitHub org/account can't be connected to another Sentry org."
//             )}
//           </PrereqSubText>
//         </Prereq>
//         <Prereq>
//           <PrereqMainText>{t('Connect your GitHub identities in Sentry')}</PrereqMainText>
//           <PrereqSubText>
//             {t('In your Sentry ')}
//             <Link to="https://sentry.io/settings/account/identities">
//               {t('identities')}
//             </Link>
//             {t(
//               " settings, link your GitHub account to your profile. If you're having trouble adding the integration, "
//             )}
//             <Link to="https://sentry.io/settings/account/identities">
//               {t('disconnect')}
//             </Link>
//             {t(' then ')}
//             {/* TODO: figma file links to https://sentry.io/auth/login/?next=/auth/sso/account/settings/social/associate/co[…]D6ee6a67e71b4459e8e4c%26state%3D7nJAqWF3l4bkczXAPzTcfo8EKIvSHyiB
//               but not sure how to get the link to that currently */}
//             <Link to="">{t('reconnect')}</Link>
//             {t(' your GitHub identity.')}
//           </PrereqSubText>
//         </Prereq>
//       </Prerequisites>
//     </PrerequisitesSection>
//   );
// }

// Note: update these styles to match the new theming
// const PrerequisitesSection = styled('div')`
//   border-top: 1px solid ${p => p.theme.border};
//   margin-top: 24px;
//   padding-top: ${p => p.theme.space['2xl']};
// `;

// const Prerequisites = styled('div')`
//   background-color: ${p => p.theme.backgroundSecondary};
//   padding: 24px;
//   border: 1px solid ${p => p.theme.border};
//   border-radius: 10px;
//   margin-bottom: ${p => p.theme.space.lg};
//   gap: ${p => p.theme.space.lg};
// `;

// const Prereq = styled('div')`
//   margin-bottom: ${p => p.theme.space.lg};
//   max-width: 1000px;
// `;

// const PrerequisitesTitle = styled('p')`
//   font-size: 16px;
// `;

// const PrereqMainText = styled('p')`
//   font-weight: 600;
//   margin: 0;
// `;

// const PrereqSubText = styled('p')`
//   font-weight: 400;
//   margin: 0;
// `;
