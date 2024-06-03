import {Fragment} from 'react';
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openRemoteConfigCreateFeatureModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import EmptyMessage from 'sentry/components/emptyMessage';
import TextArea from 'sentry/components/forms/controls/textarea';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import FieldControl from 'sentry/components/forms/fieldGroup/fieldControl';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {Flex} from 'sentry/components/profiling/flex';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Slider} from 'sentry/components/slider';
import SplitDiff from 'sentry/components/splitDiff';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconSubtract} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {RemoteConfigFeature, RemoteConfigOptions} from 'sentry/types/remoteConfig';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import useRemoteConfigSettings from 'sentry/views/settings/project/remoteConfig/useRemoteConfigSettings';

type RouteParams = {
  projectId: string;
};
type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
};

export default function RemoteConfigContainer(props: Props) {
  return (
    <Feature
      features="remote-config"
      organization={props.organization}
      renderDisabled={NoAccess}
    >
      <NoProjectMessage organization={props.organization}>
        <ProjectRemoteConfig {...props} />
      </NoProjectMessage>
    </Feature>
  );
}

function NoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}

function ProjectRemoteConfig({organization, project, params: {projectId}}: Props) {
  const {result, staged, dispatch, handleSave, handleDelete} = useRemoteConfigSettings({
    organization,
    projectId,
  });

  const disabled = result.isLoading || result.isFetching;

  const addFeatureButton = (
    <Flex justify="flex-end">
      <Button
        size="xs"
        onClick={() => {
          openRemoteConfigCreateFeatureModal({
            createFeature: (key: string, value: string) =>
              dispatch({type: 'addFeature', key, value}),
            isValid: key =>
              !staged.data.features.map(feature => feature.key).includes(key),
          });
        }}
      >
        {t('Add Feature')}
      </Button>
    </Flex>
  );

  return (
    <SentryDocumentTitle title={t('Remote Config')} projectSlug={project.slug}>
      <SettingsPageHeader title={t('Remote Config')} />
      <Panel>
        <PanelHeader>{t('Settings')}</PanelHeader>
        <PanelBody>
          <OptionsPanelContent
            disabled={disabled}
            dispatch={dispatch}
            options={staged.data.options}
          />
        </PanelBody>
      </Panel>
      <FeaturesPanelTable
        isLoading={result.isLoading}
        headers={[t('Feature Key'), t('Feature Value'), addFeatureButton]}
      >
        <FeaturesPanelContent
          disabled={disabled}
          dispatch={dispatch}
          features={staged.data.features || []}
        />
      </FeaturesPanelTable>

      <PanelTable headers={['Current Config', 'Proposed Config']}>
        <PreviewPanelContent result={result} staged={staged} />
      </PanelTable>

      <SaveRow
        result={result}
        staged={staged}
        handleSave={handleSave}
        dispatch={dispatch}
      />

      <Panel>
        <PanelHeader>{t('Danger Zone')}</PanelHeader>
        <PanelBody>
          <DangerZonePanelContent
            onDelete={handleDelete}
            project={project}
            result={result}
          />
        </PanelBody>
      </Panel>
    </SentryDocumentTitle>
  );
}

function OptionsPanelContent({
  disabled,
  dispatch,
  options,
}: {
  disabled: boolean;
  dispatch: ReturnType<typeof useRemoteConfigSettings>['dispatch'];
  options: RemoteConfigOptions;
}) {
  return (
    <Fragment>
      <FieldGroup
        id="sample_rate"
        label={t('Sample Rate')}
        help={t(
          'Configures the sample rate for error events, in the range of 0.0 to 1.0. The default is 1.0 which means that 100% of error events are sent. If set to 0.1 only 10% of error events will be sent. Events are picked randomly.'
        )}
      >
        <FieldControl>
          <Slider
            id="sample_rate"
            aria-describedby="sample_rate_help"
            aria-label={t('Sample Rate')}
            disabled={disabled}
            onChangeEnd={value => {
              dispatch({
                type: 'updateOption',
                key: 'sample_rate',
                value: value as number,
              });
            }}
            showThumbLabels
            min={0}
            max={1}
            step={0.01}
            value={options.sample_rate}
          />
        </FieldControl>
      </FieldGroup>
      <FieldGroup
        id="traces_sample_rate"
        label={t('Traces Sample Rate')}
        help={t(
          'A number between 0 and 1, controlling the percentage chance a given transaction will be sent to Sentry. (0 represents 0% while 1 represents 100%.) Applies equally to all transactions created in the app. Either this or traces_sampler must be defined to enable tracing.'
        )}
      >
        <FieldControl>
          <Slider
            id="traces_sample_rate"
            aria-describedby="traces_sample_rate_help"
            aria-label={t('Traces Sample Rate')}
            disabled={disabled}
            onChangeEnd={value => {
              dispatch({
                type: 'updateOption',
                key: 'traces_sample_rate',
                value: value as number,
              });
            }}
            showThumbLabels
            min={0}
            max={1}
            step={0.01}
            value={options.traces_sample_rate}
          />
        </FieldControl>
      </FieldGroup>
    </Fragment>
  );
}

function FeaturesPanelContent({
  disabled,
  dispatch,
  features,
}: {
  disabled: boolean;
  dispatch: ReturnType<typeof useRemoteConfigSettings>['dispatch'];
  features: RemoteConfigFeature[];
}) {
  if (!features.length) {
    return (
      <Fragment>
        <ColSpanner>
          <EmptyMessage>{t('No features defined')}</EmptyMessage>
        </ColSpanner>
        <div style={{padding: 0}} />
        <div style={{padding: 0}} />
      </Fragment>
    );
  }

  return features.map(feature => {
    return [
      <div key={`key[${feature.key}]`}>
        <TextCopyInput size="sm">{feature.key}</TextCopyInput>
      </div>,
      <div key={`value[${feature.key}]`}>
        <TextArea
          name={`feature[${feature.key}]`}
          defaultValue={feature.value}
          rows={2}
          onChange={event => {
            const value = event.currentTarget.value;
            dispatch({type: 'updateFeature', key: feature.key, value});
          }}
        />
      </div>,
      <Flex justify="flex-end" key={`remove[${feature.key}]`}>
        <Button
          size="xs"
          disabled={disabled}
          icon={<IconSubtract isCircled />}
          aria-label={t('Remove')}
          onClick={() => {
            dispatch({type: 'removeFeature', key: feature.key});
          }}
        >
          {t('Remove')}
        </Button>
      </Flex>,
    ];
  });
}

function PreviewPanelContent({
  result,
  staged,
}: {
  result: ReturnType<typeof useRemoteConfigSettings>['result'];
  staged: ReturnType<typeof useRemoteConfigSettings>['staged'];
}) {
  const baseJSON = JSON.stringify(result.data, null, '\t');
  const targetJSON = JSON.stringify(staged, null, '\t');
  return (
    <Fragment>
      <ColSpanner>
        <SplitDiff key="diff" type="words" base={baseJSON} target={targetJSON} />
      </ColSpanner>
      <div style={{padding: 0}} />
    </Fragment>
  );
}

function SaveRow({
  dispatch,
  handleSave,
  result,
  staged,
}: {
  dispatch: ReturnType<typeof useRemoteConfigSettings>['dispatch'];
  handleSave: ReturnType<typeof useRemoteConfigSettings>['handleSave'];
  result: ReturnType<typeof useRemoteConfigSettings>['result'];
  staged: ReturnType<typeof useRemoteConfigSettings>['staged'];
}) {
  const baseJSON = JSON.stringify(result.data, null, '\t');
  const targetJSON = JSON.stringify(staged, null, '\t');
  const isDisabled = !result.data || baseJSON === targetJSON;

  const handleRevert = result.data
    ? () => dispatch({type: 'revertStaged', data: result.data})
    : () => {};

  return (
    <ButtonFlex gap={space(2)}>
      <Button
        size="md"
        priority="primary"
        onClick={() => {
          addLoadingMessage(t('Saving remote config...'));
          handleSave(
            () => addSuccessMessage(t('Remote config saved')),
            () => addErrorMessage(t('Unable to save remote config'))
          );
        }}
        disabled={isDisabled}
      >
        {t('Save Changes')}
      </Button>
      <Button size="md" onClick={handleRevert} disabled={isDisabled}>
        {t('Revert Changes')}
      </Button>
    </ButtonFlex>
  );
}

function DangerZonePanelContent({
  onDelete,
  project,
  result,
}: {
  onDelete: ReturnType<typeof useRemoteConfigSettings>['handleDelete'];
  project: Project;
  result: ReturnType<typeof useRemoteConfigSettings>['result'];
}) {
  const disabled = result.isError;

  return (
    <FieldGroup
      label={t('Delete Remote Config')}
      help={tct(
        'If you want to start over, you can delete the remote config for [projectName].',
        {projectName: <strong>{project.slug}</strong>}
      )}
    >
      <FieldControl>
        <div>
          <Button
            priority="danger"
            disabled={disabled}
            onClick={() => {
              openConfirmModal({
                header: t('Delete Remote Config'),
                message: t(
                  'Are you sure you want to delete the remote config for %s back to defaults? This cannot be undone.',
                  project.slug
                ),
                onConfirm: () => {
                  addLoadingMessage(t('Deleting remote config...'));
                  onDelete(
                    () => addSuccessMessage(t('Remote config deleted')),
                    () => addErrorMessage(t('Unable to delete remote config'))
                  );
                },
              });
            }}
          >
            {t('Delete Config')}
          </Button>
        </div>
      </FieldControl>
    </FieldGroup>
  );
}

const ButtonFlex = styled(Flex)`
  margin-bottom: ${space(4)};
`;

const FeaturesPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 2fr max-content;
`;

const ColSpanner = styled('div')`
  display: flex;
  flex-flow: column;
  grid-column-end: -1;
  grid-column-start: 1;
`;
