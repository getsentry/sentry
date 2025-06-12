import type {ReactNode} from 'react';
import {useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconClose, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function InfoBanner({children}: {children: ReactNode}) {
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return null;
  }
  return (
    <Banner>
      <Flex gap={space(1.5)} align="center">
        <IconInfo size="md" />
        {children}
      </Flex>
      <Button
        aria-label={t('Close info')}
        size="sm"
        icon={<IconClose color="purple400" />}
        borderless
        onClick={() => setHidden(true)}
      />
    </Banner>
  );
}

const Banner = styled('div')`
  display: flex;
  background-color: ${p => p.theme.purple100};
  justify-content: space-between;
  color: ${p => p.theme.purple400};
  flex-direction: row;
  align-items: center;
  border: 1px ${p => p.theme.purple300} solid;
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.75)} ${space(0.25)} ${space(0.75)} ${space(1.5)};
`;

export const BannerLink = styled(ExternalLink)`
  color: ${p => p.theme.purple400};
  text-decoration: underline;

  &:hover {
    color: ${p => p.theme.purple400};
    text-decoration: none;
  }
`;
