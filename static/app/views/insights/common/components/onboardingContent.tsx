import {Fragment} from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  description: string;
  link: string;
  title: string;
};

export function OnboardingContent({description, link, title}: Props) {
  return (
    <Fragment>
      <Header>{title}</Header>
      <p>
        {description} <ExternalLink href={link}>{t('Learn more')}</ExternalLink>
      </p>
    </Fragment>
  );
}

const Header = styled('h3')`
  margin-bottom: ${space(1)};
`;
