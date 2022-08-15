/* eslint-disable import/no-unresolved */

import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import Counter from 'remote/counter';

import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import Header from './header';

type Props = RouteComponentProps<{orgId: string}, {}>;

function FooBar({}: Props) {
  const organization = useOrganization();
  return (
    <Fragment>
      <SentryDocumentTitle title={t('FOO BAR')} />
      <Header organization={organization} activeTab="foobar" />

      <Body>
        <Layout.Main fullWidth>
          <Counter />
        </Layout.Main>
      </Body>
    </Fragment>
  );
}

export default FooBar;

const Body = styled(Layout.Body)`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: block;
  }
`;
