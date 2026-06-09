import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';

type Props =
  | {
      title: React.ReactNode;
      action?: never;
      /**
       *  @deprecated Use flex for spacing instead! But `xl` is a good size.
       */
      marginBottom?: never;
      subtitle?: never;
    }
  | {
      /**
       *  @deprecated Use flex for spacing instead! But `xl` is a good size.
       */
      marginBottom: FlexProps['marginBottom'];
      title: React.ReactNode;
      action?: React.ReactNode;
      subtitle?: React.ReactNode;
    };

export function SettingsPageHeader({title, subtitle, action, marginBottom}: Props) {
  return (
    <Fragment>
      {typeof title === 'string' ? (
        <BreadcrumbTitle title={title} />
      ) : (
        title && <Layout.Title>{title}</Layout.Title>
      )}
      {(subtitle || action) && (
        <Flex
          marginBottom={marginBottom}
          width="100%"
          justify="between"
          align="start"
          gap="md"
        >
          <Subtitle>{subtitle}</Subtitle>
          {action}
        </Flex>
      )}
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
