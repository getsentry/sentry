import {Fragment, useEffect, useState} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import {recreateRoute} from 'sentry/utils/recreateRoute';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';

interface Props extends ModalRenderProps {
  slug: string;
}

function RedirectToProjectModal({slug, Header, Body}: Props) {
  const routes = useRoutes();
  const params = useParams();
  const location = useLocation();

  const [timer, setTimer] = useState(5);

  const newPath = recreateRoute('', {
    routes,
    location,
    params: {...params, projectId: slug},
  });

  useEffect(() => {
    const interval = window.setInterval(() => setTimer(value => value - 1), 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (timer <= 0) {
      testableWindowLocation.assign(newPath);
    }
  }, [timer, newPath]);

  return (
    <Fragment>
      <Header>{t('Redirecting to New Project...')}</Header>

      <Body>
        <Flex direction="column" gap="lg">
          <Flex direction="column" gap="sm">
            <Text>{t('The project slug has been changed.')}</Text>
            <Text variant="muted">
              {tct(
                'You will be redirected to the new project [project] in [timer] seconds...',
                {
                  project: <strong>{slug}</strong>,
                  timer,
                }
              )}
            </Text>
          </Flex>
          <Flex justify="end">
            <LinkButton priority="primary" href={newPath}>
              {t('Continue to %s', slug)}
            </LinkButton>
          </Flex>
        </Flex>
      </Body>
    </Fragment>
  );
}

export {RedirectToProjectModal};
