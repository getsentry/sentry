import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function Sandbox() {
  const organization = useOrganization();
  const onClick = () => openCreateTeamModal({organization});
  return (
    <Layout.Page>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>{t('Sandbox')}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main>
          <Button onClick={onClick}>Open Modal</Button>
          <Flex height="200vh" />
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}
