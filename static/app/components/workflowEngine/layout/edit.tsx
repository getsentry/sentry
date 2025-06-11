import styled from '@emotion/styled';

import EditableText from 'sentry/components/editableText';
import FormField from 'sentry/components/forms/formField';
import * as Layout from 'sentry/components/layouts/thirds';
import {ActionsFromContext} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsFromContext} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface WorkflowEngineEditLayoutProps {
  /**
   * The main content for this page
   * Expected to include `<EditLayout.Chart>` and `<EditLayout.Panel>` components.
   */
  children: React.ReactNode;
  onTitleChange?: (title: string) => void;
}

/**
 * Precomposed full-width layout for Automations / Monitors edit pages.
 */
function EditLayout({children, onTitleChange}: WorkflowEngineEditLayoutProps) {
  return (
    <Layout.Page>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <BreadcrumbsFromContext />
          <Layout.Title>
            <FormField
              name="title"
              inline={false}
              flexibleControlStateSize
              stacked
              onChange={onTitleChange}
            >
              {({onChange, value}) => (
                <EditableText
                  isDisabled={false}
                  value={value || ''}
                  onChange={newValue => {
                    onChange(newValue, {
                      target: {
                        value: newValue,
                      },
                    });
                  }}
                  errorMessage={t('Please set a title')}
                  placeholder={t('New Monitor')}
                />
              )}
            </FormField>
          </Layout.Title>
        </Layout.HeaderContent>
        <ActionsFromContext />
      </Layout.Header>
      <Body>{children}</Body>
    </Layout.Page>
  );
}

const Body = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  flex-grow: 1;
`;

const ChartContainer = styled('div')`
  display: flex;
  flex-direction: column;
  background-color: ${p => p.theme.background};
  gap: ${space(3)};
  width: 100%;
  flex-grow: 1;
  padding: ${space(1)} ${space(4)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const PanelsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(3)} ${space(4)};
  gap: ${space(2)};
  width: 100%;
  flex-grow: 1;
`;

function Chart({children}: any) {
  return <ChartContainer>{children}</ChartContainer>;
}

function Panels({children}: any) {
  return <PanelsContainer>{children}</PanelsContainer>;
}

const WorkflowEngineEditLayout = Object.assign(EditLayout, {Chart, Panels});

export default WorkflowEngineEditLayout;
