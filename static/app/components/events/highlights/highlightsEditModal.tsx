import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {TagColumn} from 'sentry/components/events/eventTags/eventTagsTree';
import {TagRow} from 'sentry/components/events/eventTags/eventTagsTreeRow';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTag, Project} from 'sentry/types';

interface HighlightsEditModalProps extends ModalRenderProps {
  detailedProject: Project;
}

export default function HighlightsEditModal({
  Header,
  Body,
  Footer,
  detailedProject,
  closeModal,
}: HighlightsEditModalProps) {
  const previewData = [
    {key: 'browser', value: 'Chrome 120.0.0'},
    {key: 'environment', value: 'prd'},
    {key: 'plan.name', value: 'am2_business'},
    {key: 'os', value: 'Mac OS X >=10.15.7'},
    {key: 'user', value: 'prod'},
  ];
  const previewColumnCount = 2;

  const previewColumnSize = Math.ceil(previewData.length / previewColumnCount);
  const previewColumns: React.ReactNode[] = [];
  for (let i = 0; i < previewData.length; i += previewColumnSize) {
    previewColumns.push(
      <EditPreviewColumn key={i}>
        {previewData.slice(i, i + previewColumnSize).map((tag, j) => (
          <EditPreviewItem key={j} project={detailedProject} previewTag={tag} />
        ))}
      </EditPreviewColumn>
    );
  }

  const columnCount = 3;

  const tagData = [
    'customerDomain',
    'customerDomain.name',
    'customerDomain.organizationUrl',
    'customerDomain.sentryUrl',
    'device',
    'device.subdomain',
    'device.family',
    'isCustomerDomain',
    'level',
    'mechanism',
    'organization',
    'organization.slug',
    'plan',
    'plan.tier',
    'plan.total_members',
    'plan.max_members',
    'os.family',
    'os.release',
    'replay_id',
    'sentry_version',
    'timeOrigin',
    'transaction',
    'transaction.mode',
  ];

  const tagColumnSize = Math.ceil(tagData.length / columnCount);
  const tagColumns: React.ReactNode[] = [];
  for (let i = 0; i < tagData.length; i += tagColumnSize) {
    tagColumns.push(
      <EditHighlightColumn key={i}>
        {tagData.slice(i, i + tagColumnSize).map((tagKey, j) => (
          <EditTagItem key={j} tagKey={tagKey} />
        ))}
      </EditHighlightColumn>
    );
  }

  const ctxData = {
    response: ['status_code'],
    browser: ['name', 'version'],
    'operating system': ['name'],
    runtime: ['name', 'version'],
    user: ['email', 'id', 'ip address'],
    organization: ['id', 'slug'],
    replay: ['replay_id', 'slug'],
    trace: ['status', 'trace id'],
  };

  const ctxItems = Object.entries(ctxData);
  const ctxColumnSize = Math.ceil(ctxItems.length / columnCount);
  const contextColumns: React.ReactNode[] = [];
  for (let i = 0; i < ctxItems.length; i += ctxColumnSize) {
    contextColumns.push(
      <EditHighlightColumn key={i}>
        {ctxItems.slice(i, i + ctxColumnSize).map(([contextType, contextKeys], j) => (
          <EditContextItem key={j} contextType={contextType} contextKeys={contextKeys} />
        ))}
      </EditHighlightColumn>
    );
  }

  return (
    <Fragment>
      <Header>
        <Title>{t('Edit Event Highlights')}</Title>
      </Header>
      <Body>
        <EditHighlightPreview columnCount={previewColumnCount}>
          {previewColumns}
        </EditHighlightPreview>
        <EditHighlightSection>
          <Subtitle>{t('Tags')}</Subtitle>
          <EditHighlightSectionContent columnCount={columnCount}>
            {tagColumns}
          </EditHighlightSectionContent>
        </EditHighlightSection>
        <EditHighlightSection>
          <Subtitle>{t('Context')}</Subtitle>
          <EditHighlightSectionContent columnCount={columnCount}>
            {contextColumns}
          </EditHighlightSectionContent>
        </EditHighlightSection>
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button priority="primary" onClick={() => {}}>
            {t('Save')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

interface EditPreviewItemProps {
  previewTag: EventTag;
  project: Project;
}
function EditPreviewItem({project, previewTag}: EditPreviewItemProps) {
  return (
    <Fragment>
      <EditButton
        aria-label={`Remove ${previewTag.key} from highlights`}
        icon={<IconSubtract />}
        size="xs"
      />
      <EditPreviewRow projectSlug={project.slug} tag={previewTag} meta={{}} />
    </Fragment>
  );
}

interface EditTagItemProps {
  tagKey: string;
}

function EditTagItem({tagKey}: EditTagItemProps) {
  return (
    <EditTagContainer>
      <EditButton
        aria-label={`Add ${tagKey} tag to highlights`}
        icon={<IconAdd />}
        size="xs"
      />
      <HighlightKey>{tagKey}</HighlightKey>
    </EditTagContainer>
  );
}

interface EditContextItemProps {
  contextKeys: string[];
  contextType: string;
}

function EditContextItem({contextKeys, contextType}: EditContextItemProps) {
  return (
    <EditContextContainer>
      <ContextType>{contextType}</ContextType>
      {contextKeys.map((ck, i) => (
        <Fragment key={i}>
          <EditButton
            aria-label={`Add ${ck} from ${contextType} context to highlights`}
            icon={<IconAdd />}
            size="xs"
          />
          <HighlightKey>{ck}</HighlightKey>
        </Fragment>
      ))}
    </EditContextContainer>
  );
}

const Title = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Subtitle = styled('h4')`
  font-size: ${p => p.theme.fontSizeMedium};
  border-bottom: 1px solid ${p => p.theme.border};
  margin-bottom: ${space(1.5)};
  padding-bottom: ${space(0.5)};
`;

const EditHighlightPreview = styled('div')<{columnCount: number}>`
  border: 1px dashed ${p => p.theme.border};
  border-radius: 4px;
  padding: ${space(2)};
  display: grid;
  grid-template-columns: repeat(${p => p.columnCount}, minmax(0, 1fr));
  align-items: start;
  margin: 0 -${space(1.5)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const EditPreviewColumn = styled(TagColumn)`
  grid-template-columns: 22px auto 1fr;
  column-gap: 0;
  button {
    margin-right: ${space(0.25)};
  }
  .row-value {
    margin-left: 20px;
  }
`;

const EditHighlightSection = styled('div')`
  margin-top: 25px;
`;

const EditHighlightSectionContent = styled('div')<{columnCount: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.columnCount}, minmax(0, 1fr));
`;

const EditHighlightColumn = styled(`div`)`
  flex: 1;
  &:not(:first-child) {
    border-left: 1px solid ${p => p.theme.innerBorder};
    padding-left: ${space(2)};
    margin-left: -1px;
  }
  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.innerBorder};
    padding-right: ${space(2)};
  }
`;

const EditPreviewRow = styled(TagRow)`
  :nth-child(4n-2) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const EditTagContainer = styled('div')`
  display: grid;
  grid-template-columns: 26px 1fr;
  font-size: ${p => p.theme.fontSizeSmall};
  align-items: center;
`;

const EditContextContainer = styled(EditTagContainer)`
  margin-bottom: ${space(1)};
`;

const EditButton = styled(Button)`
  grid-column: span 1;
  color: ${p => p.theme.subText};
  width: 18px;
  height: 18px;
  min-height: 18px;
  border-radius: 4px;
  margin: ${space(0.25)} 0;
  align-self: start;
  svg {
    height: 10px;
    width: 10px;
  }
`;

const HighlightKey = styled('p')`
  grid-column: span 1;
  color: ${p => p.theme.subText};
  font-family: ${p => p.theme.text.familyMono};
  margin-bottom: 0;
  word-wrap: break-word;
  word-break: break-all;
  display: inline-block;
`;

const ContextType = styled('p')`
  grid-column: span 2;
  font-weight: bold;
  text-transform: capitalize;
  margin-bottom: ${space(0.25)};
`;
