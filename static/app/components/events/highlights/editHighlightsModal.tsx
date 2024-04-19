import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {TagColumn} from 'sentry/components/events/eventTags/eventTagsTree';
import type {EventTagMap} from 'sentry/components/events/highlights/highlightsDataSection';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Project} from 'sentry/types';

interface EditHighlightsModalProps extends ModalRenderProps {
  detailedProject: Project;
  event: Event;
  previewRows: React.ReactNode[];
  tagMap: EventTagMap;
}

interface EditPreviewHighlightSectionProps {
  onRemovePreview: () => void;
  previewRows: EditHighlightsModalProps['previewRows'];
}

function EditPreviewHighlightSection({previewRows}: EditPreviewHighlightSectionProps) {
  const previewColumnCount = 2;
  const previewColumnSize = Math.ceil(previewRows.length / previewColumnCount);
  const previewColumns: React.ReactNode[] = [];
  for (let i = 0; i < previewRows.length; i += previewColumnSize) {
    previewColumns.push(
      <EditPreviewColumn key={i}>
        {previewRows.slice(i, i + previewColumnSize).map((previewRow, j) => (
          <Fragment key={j}>
            <EditButton
              aria-label={`Remove from highlights`}
              icon={<IconSubtract />}
              size="xs"
            />
            {previewRow}
          </Fragment>
        ))}
      </EditPreviewColumn>
    );
  }
  return (
    <EditHighlightPreview columnCount={previewColumnCount}>
      {previewColumns}
    </EditHighlightPreview>
  );
}

interface EditTagHighlightSectionProps {
  columnCount: number;
  onAddTag: (tagKey: string) => void;
  tagMap: EditHighlightsModalProps['tagMap'];
}

function EditTagHighlightSection({
  columnCount,
  onAddTag,
  tagMap,
}: EditTagHighlightSectionProps) {
  const tagData = Object.keys(tagMap);
  const tagColumnSize = Math.ceil(tagData.length / columnCount);
  const tagColumns: React.ReactNode[] = [];
  for (let i = 0; i < tagData.length; i += tagColumnSize) {
    tagColumns.push(
      <EditHighlightColumn key={i}>
        {tagData.slice(i, i + tagColumnSize).map((tagKey, j) => (
          <EditTagContainer key={j}>
            <EditButton
              aria-label={`Add ${tagKey} tag to highlights`}
              icon={<IconAdd />}
              size="xs"
              onClick={() => onAddTag(tagKey)}
            />
            <HighlightKey>{tagKey}</HighlightKey>
          </EditTagContainer>
        ))}
      </EditHighlightColumn>
    );
  }
  return (
    <EditHighlightSection>
      <Subtitle>{t('Tags')}</Subtitle>
      <EditHighlightSectionContent columnCount={columnCount}>
        {tagColumns}
      </EditHighlightSectionContent>
    </EditHighlightSection>
  );
}
interface EditContextHighlightSectionProps {
  columnCount: number;
  event: EditHighlightsModalProps['event'];
  onAddContextKey: (contextType: string, contextKey: string) => void;
}

function EditContextHighlightSection({
  columnCount,
  event,
  onAddContextKey,
}: EditContextHighlightSectionProps) {
  const ctxData: Record<string, string[]> = getOrderedContextItems(event).reduce(
    (acc, [alias, context]) => {
      acc[alias] = Object.keys(context).filter(k => k !== 'type');
      return acc;
    },
    {}
  );
  const ctxItems = Object.entries(ctxData);
  const ctxColumnSize = Math.ceil(ctxItems.length / columnCount);
  const contextColumns: React.ReactNode[] = [];
  for (let i = 0; i < ctxItems.length; i += ctxColumnSize) {
    contextColumns.push(
      <EditHighlightColumn key={i}>
        {ctxItems.slice(i, i + ctxColumnSize).map(([contextType, contextKeys], j) => (
          <EditContextContainer key={j}>
            <ContextType>{contextType}</ContextType>
            {contextKeys.map((contextKey, k) => (
              <Fragment key={k}>
                <EditButton
                  aria-label={`Add ${contextKey} from ${contextType} context to highlights`}
                  icon={<IconAdd />}
                  size="xs"
                  onClick={() => onAddContextKey(contextType, contextKey)}
                />
                <HighlightKey>{contextKey}</HighlightKey>
              </Fragment>
            ))}
          </EditContextContainer>
        ))}
      </EditHighlightColumn>
    );
  }

  return (
    <EditHighlightSection>
      <Subtitle>{t('Context')}</Subtitle>
      <EditHighlightSectionContent columnCount={columnCount}>
        {contextColumns}
      </EditHighlightSectionContent>
    </EditHighlightSection>
  );
}

export default function EditHighlightsModal({
  Header,
  Body,
  Footer,
  event,
  previewRows = [],
  tagMap,
  closeModal,
}: EditHighlightsModalProps) {
  const columnCount = 3;

  return (
    <Fragment>
      <Header>
        <Title>{t('Edit Event Highlights')}</Title>
      </Header>
      <Body>
        <EditPreviewHighlightSection
          previewRows={previewRows}
          onRemovePreview={() => {}}
        />
        <EditTagHighlightSection
          columnCount={columnCount}
          tagMap={tagMap}
          onAddTag={_tk => {}}
        />
        <EditContextHighlightSection
          event={event}
          columnCount={columnCount}
          onAddContextKey={_ck => {}}
        />
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button onClick={closeModal} size="sm">
            {t('Cancel')}
          </Button>
          <Button priority="primary" size="sm" onClick={() => {}}>
            {t('Save')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
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
  .tag-row:nth-child(4n-2) {
    background-color: ${p => p.theme.backgroundSecondary};
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
