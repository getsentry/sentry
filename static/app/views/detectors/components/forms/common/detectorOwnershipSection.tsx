import {useMemo} from 'react';

import {useStore, withFieldGroup} from '@sentry/scraps/form';
import {Container as LayoutContainer, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';

import {MarkdownTextArea} from 'sentry/components/markdownTextArea';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import {useOwnerOptions} from 'sentry/utils/useOwnerOptions';
import {useOwners} from 'sentry/utils/useOwners';

import {useDetectorProject} from './useDetectorProject';

export const DetectorOwnershipSection = withFieldGroup({
  defaultValues: {
    projectId: '',
    owner: '',
    description: null as string | null,
  },
  props: {} as {step?: number},
  render: function DetectorOwnershipSection({group, step}) {
    const projectId = useStore(group.store, state => state.values.projectId);
    const owner = useStore(group.store, state => state.values.owner);
    const project = useDetectorProject(projectId);
    const currentValue = useMemo(() => (owner ? [owner] : undefined), [owner]);
    const {teams, members, fetching, onTeamSearch, onMemberSearch} = useOwners({
      currentValue,
    });
    const options = useOwnerOptions({
      teams,
      members,
      avatarProps: {size: 20},
      memberOfProjectSlugs: [project.slug],
    });
    return (
      <Container>
        <FormSection step={step} title={t('Issue Ownership')}>
          <Stack gap="lg">
            <group.AppField name="owner">
              {field => (
                <field.Layout.Stack
                  label={t('Assign')}
                  hintText={t(
                    'Sentry will assign issues detected by this monitor to this individual or team.'
                  )}
                >
                  <field.Base>
                    {({ref: _ref, id, ...baseProps}) => (
                      <LayoutContainer flex={1} minWidth={0}>
                        <Select
                          {...baseProps}
                          inputId={id}
                          value={field.state.value}
                          onChange={option => field.handleChange(option?.value ?? '')}
                          options={options}
                          clearable
                          isLoading={fetching}
                          placeholder={t('Select a member or team')}
                          onInputChange={value => {
                            onMemberSearch(value);
                            onTeamSearch(value);
                          }}
                        />
                      </LayoutContainer>
                    )}
                  </field.Base>
                </field.Layout.Stack>
              )}
            </group.AppField>
            <group.AppField name="description">
              {field => (
                <field.Layout.Stack
                  label={t('Describe')}
                  hintText={t(
                    'Add any additional context about this monitor for other team members.'
                  )}
                >
                  <field.Base>
                    {({ref: _ref, ...baseProps}) => (
                      <LayoutContainer flex={1} minWidth={0}>
                        <MarkdownTextArea
                          {...baseProps}
                          value={field.state.value ?? ''}
                          onChange={event => field.handleChange(event.target.value)}
                          aria-label={t('description')}
                          placeholder={t(
                            'Example monitor description\n\nTo debug follow these steps:\n1. \u2026\n2. \u2026\n3. \u2026'
                          )}
                        />
                      </LayoutContainer>
                    )}
                  </field.Base>
                </field.Layout.Stack>
              )}
            </group.AppField>
          </Stack>
        </FormSection>
      </Container>
    );
  },
});
