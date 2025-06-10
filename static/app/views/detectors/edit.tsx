/* eslint-disable no-alert */
import {Fragment, useState} from 'react';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {StickyFooter} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {MetricDetectorForm} from 'sentry/views/detectors/components/forms/metric';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

export default function DetectorEdit() {
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});
  const [title, setTitle] = useState(t('Edit Monitor'));
  const [model] = useState(() => new FormModel());

  return (
    <SentryDocumentTitle title={title} noSuffix>
      <BreadcrumbsProvider
        crumb={{label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)}}
      >
        <ActionsProvider actions={<Actions />}>
          <Form
            hideFooter
            model={model}
            onSubmit={data => {
              console.log({data});
            }}
          >
            <EditLayout onTitleChange={setTitle} title={title}>
              <MetricDetectorForm />
              <StickyFooter>
                <Flex justify="flex-end" flex={1}>
                  <Flex gap={space(1)}>
                    <LinkButton
                      priority="default"
                      to={`${makeMonitorBasePathname(organization.slug)}new/`}
                    >
                      {t('Back')}
                    </LinkButton>
                    <Button priority="primary" type="submit">
                      {t('Save')}
                    </Button>
                  </Flex>
                </Flex>
              </StickyFooter>
            </EditLayout>
          </Form>
        </ActionsProvider>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}

function Actions() {
  const disable = () => {
    window.alert('disable');
  };
  const del = () => {
    window.alert('delete');
  };
  const save = () => {
    window.alert('save');
  };
  return (
    <Fragment>
      <Button onClick={disable}>{t('Disable')}</Button>
      <Button onClick={del} priority="danger">
        {t('Delete')}
      </Button>
      <Button onClick={save} priority="primary">
        {t('Save')}
      </Button>
    </Fragment>
  );
}
