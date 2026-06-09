import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';

type Props = {
  title: React.ReactNode;
  action?: React.ReactNode;
  subtitle?: React.ReactNode;
  tabs?: React.ReactNode;
};

export function SettingsPageHeader({title, subtitle, action, tabs}: Props) {
  return (
    <Fragment>
      {typeof title === 'string' ? (
        <BreadcrumbTitle title={title} />
      ) : (
        title && <Layout.Title>{title}</Layout.Title>
      )}
      {(subtitle || action) && (
        <Flex marginBottom="xl" width="100%" justify="between" align="start" gap="md">
          <Subtitle>{subtitle}</Subtitle>
          {action}
        </Flex>
      )}
      {tabs && <TabsWrapper>{tabs}</TabsWrapper>}
    </Fragment>
  );
}

const Subtitle = styled('div')`
  width: 100%;
  max-width: 72ch;
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  font-size: ${p => p.theme.font.size.md};
`;

const TabsWrapper = styled('div')`
  flex: 1;
  margin: 0;
`;
