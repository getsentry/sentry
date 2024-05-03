import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import NumberField from 'sentry/components/forms/fields/numberField';
import Form from 'sentry/components/forms/form';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

type Props = {
  isLoading: boolean;
  project: Project;
};

function transformData(data) {
  const limit = data.relayCustomMetricCardinalityLimit;
  return {
    relayCustomMetricCardinalityLimit: limit === '' ? null : limit,
  };
}

export function CardinalityLimit({project, isLoading}: Props) {
  const endpoint = `/projects/${project.organization.slug}/${project.slug}/`;

  return (
    <Form
      apiEndpoint={endpoint}
      apiMethod="PUT"
      saveOnBlur
      initialData={{
        relayCustomMetricCardinalityLimit: project.relayCustomMetricCardinalityLimit,
      }}
    >
      <Panel>
        <PanelHeader>{t('Limits')}</PanelHeader>
        <PanelBody>
          {isLoading ? (
            <LoadingIndicator />
          ) : (
            <Access access={['project:write']} project={project}>
              {({hasAccess}) => (
                <StyledNumberField
                  disabledReason={
                    !hasAccess
                      ? t('You do not have permission to edit the cardinality limit')
                      : undefined
                  }
                  disabled={!hasAccess}
                  name="relayCustomMetricCardinalityLimit"
                  label={t('Cardinality Limit')}
                  help={t(
                    'The cardinality limit defines the maximum number of unique tag combinations allowed for a metric (measured per hour). If the cardinality limit is exceeded, the metric will be blocked.'
                  )}
                  saveOnBlur
                  placeholder={t('Enter a value')}
                  flexibleControlStateSize
                  multiple
                  getData={transformData}
                />
              )}
            </Access>
          )}
        </PanelBody>
      </Panel>
    </Form>
  );
}

const StyledNumberField = styled(NumberField)`
  ${p => p.disabled && `cursor: not-allowed`}
`;
