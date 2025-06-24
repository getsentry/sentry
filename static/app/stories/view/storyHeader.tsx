import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import Link from 'sentry/components/links/link';
import {IconGithub, IconLink} from 'sentry/icons';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

import {StorySearch} from './storySearch';

function SentryUiLogo() {
  return (
    <svg fill="none" viewBox="0 0 34 36">
      <path
        fill="#553DB8"
        d="M.5873 8.4992c-.0482-2.761 2.151-5.0383 4.912-5.0865l21.9948-.3839c2.761-.0482 5.0383 2.151 5.0865 4.912l.384 21.9966c.0482 2.761-2.151 5.0383-4.912 5.0865l-21.9949.384c-2.761.0482-5.0383-2.151-5.0865-4.912L.5872 8.4992Z"
      />
      <path
        fill="#7553FF"
        d="M.5873 6.4992c-.0482-2.761 2.151-5.0383 4.912-5.0865l21.9948-.3839c2.761-.0482 5.0383 2.151 5.0865 4.912l.384 21.9966c.0482 2.761-2.151 5.0383-4.912 5.0865l-21.9949.384c-2.761.0482-5.0383-2.151-5.0865-4.912L.5872 6.4992Z"
      />
      <path
        fill="#fff"
        d="M18.7663 8.779a1.8625 1.8625 0 0 0-.6939-.6691 1.865 1.865 0 0 0-2.5332.7255l-2.5762 4.6441.6845.3768a13.027 13.027 0 0 1 4.6381 4.3466 13.0143 13.0143 0 0 1 2.0275 6.0221l-1.865.0326a11.1548 11.1548 0 0 0-1.7616-5.1003 11.1654 11.1654 0 0 0-3.9503-3.6785l-.6844-.3755-2.3998 4.343.6844.3768a6.2804 6.2804 0 0 1 2.0834 1.9011 6.2757 6.2757 0 0 1 1.0406 2.6204l-4.2599.0744a.3079.3079 0 0 1-.318-.3013.3073.3073 0 0 1 .0389-.1558l1.1514-2.0751a4.3185 4.3185 0 0 0-1.3688-.7496L7.5647 23.208a1.8612 1.8612 0 0 0 .727 2.5311c.286.1585.6089.2389.936.2332l5.8619-.1023-.0136-.776a7.7365 7.7365 0 0 0-.9122-3.514 7.743 7.743 0 0 0-2.4151-2.7122l.9043-1.6305a9.6094 9.6094 0 0 1 3.1019 3.383 9.6005 9.6005 0 0 1 1.1778 4.4345l.0136.7774 4.9674-.0868-.0136-.7759a14.5664 14.5664 0 0 0-1.8855-6.9042 14.5809 14.5809 0 0 0-4.9469-5.1753l1.8283-3.3007a.3073.3073 0 0 1 .2636-.1581.308.308 0 0 1 .269.1488l8.47 14.0856a.3066.3066 0 0 1 .0047.3099.307.307 0 0 1-.2677.1566l-1.9233.0336c.0335.5182.0452 1.0369.0272 1.5547l1.93-.0337a1.866 1.866 0 0 0 .9272-.2657 1.8624 1.8624 0 0 0 .9038-1.6284 1.862 1.862 0 0 0-.2655-.9266L18.7663 8.779Z"
      />
    </svg>
  );
}

export function StoryHeader() {
  return (
    <HeaderGrid>
      <Link to="/stories">
        <H1>
          <SentryUiLogo /> UI
        </H1>
      </Link>

      <StorySearch />
      <Flex gap={space(1)} style={{marginLeft: 'auto'}}>
        <LinkButton
          size="xs"
          href="https://github.com/getsentry/sentry"
          icon={<IconGithub />}
        >
          GitHub
        </LinkButton>
        <LinkButton size="xs" href="https://sentry.io" icon={<IconLink />}>
          sentry.io
        </LinkButton>
        <span />
        <Storybook.ThemeSwitcher />
      </Flex>
    </HeaderGrid>
  );
}

const HeaderGrid = styled('header')`
  display: grid;
  grid-template-columns: 256px minmax(auto, 820px) auto;
  gap: ${space(1)};
  align-items: center;
  padding: 0 ${space(1)};
  height: 53px;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  position: sticky;
  top: 0;

  input:is(input) {
    height: 32px;
    min-height: 32px;
  }
`;

const H1 = styled('h1')`
  margin: 0;
  display: flex;
  gap: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
  align-items: center;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.tokens.content.accent};

  svg {
    width: 36px;
    height: 36px;
  }
`;
