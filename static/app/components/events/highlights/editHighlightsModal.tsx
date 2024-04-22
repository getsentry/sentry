import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {ContextCardContent} from 'sentry/components/events/contexts/contextCard';
import {getContextMeta} from 'sentry/components/events/contexts/utils';
import EventTagsTreeRow from 'sentry/components/events/eventTags/eventTagsTreeRow';
import type {
  HighlightContext,
  HighlightTags,
} from 'sentry/components/events/highlights/util';
import {
  getHighlightContextItems,
  getHighlightTagItems,
} from 'sentry/components/events/highlights/util';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Project} from 'sentry/types';
import {useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface EditHighlightsModalProps extends ModalRenderProps {
  event: Event;
  highlightContext: HighlightContext;
  highlightTags: HighlightTags;
  project: Project;
}

interface EditPreviewHighlightSectionProps {
  event: Event;
  highlightContext: HighlightContext;
  highlightTags: HighlightTags;
  onRemoveContextKey: (contextType: string, contextKey: string) => void;
  onRemoveTag: (tagKey: string) => void;
  project: Project;
}

function EditPreviewHighlightSection({
  event,
  project,
  highlightContext,
  highlightTags,
  onRemoveContextKey,
  onRemoveTag,
}: EditPreviewHighlightSectionProps) {
  const organization = useOrganization();
  const previewColumnCount = 2;

  const highlightContextDataItems = getHighlightContextItems({
    event,
    project,
    organization,
    highlightContext,
  });
  const highlightContextRows = highlightContextDataItems.reduce<React.ReactNode[]>(
    (rowList, [alias, items], i) => {
      const meta = getContextMeta(event, alias);
      const newRows = items.map((item, j) => (
        <Fragment key={`edit-highlight-ctx-${i}-${j}`}>
          <EditButton
            aria-label={`Remove from highlights`}
            icon={<IconSubtract />}
            size="xs"
            onClick={() => onRemoveContextKey(alias, item.key)}
          />
          <EditPreviewContextItem
            meta={meta}
            item={item}
            alias={alias}
            config={{includeAliasInSubject: true, disableErrors: true}}
          />
        </Fragment>
      ));
      return [...rowList, ...newRows];
    },
    []
  );

  const highlightTagItems = getHighlightTagItems({event, highlightTags});
  const highlightTagRows = highlightTagItems.map((content, i) => (
    <Fragment key={`edit-highlight-tag-${i}`}>
      <EditButton
        aria-label={`Remove from highlights`}
        icon={<IconSubtract />}
        size="xs"
        onClick={() => onRemoveTag(content.originalTag.key)}
      />
      <EditPreviewTagItem
        content={content}
        event={event}
        tagKey={content.originalTag.key}
        projectSlug={project.slug}
        config={{disableActions: true, disableRichValue: true}}
      />
    </Fragment>
  ));

  const rows = [...highlightTagRows, ...highlightContextRows];
  const columns: React.ReactNode[] = [];
  const columnSize = Math.ceil(rows.length / previewColumnCount);
  for (let i = 0; i < rows.length; i += columnSize) {
    columns.push(
      <EditPreviewColumn key={`edit-highlight-column-${i}`}>
        {rows.slice(i, i + columnSize)}
      </EditPreviewColumn>
    );
  }
  return (
    <EditHighlightPreview columnCount={previewColumnCount}>
      {columns}
    </EditHighlightPreview>
  );
}

interface EditTagHighlightSectionProps {
  columnCount: number;
  event: EditHighlightsModalProps['event'];
  highlightTags: HighlightTags;
  onAddTag: (tagKey: string) => void;
}

function EditTagHighlightSection({
  columnCount,
  event,
  highlightTags,
  onAddTag,
}: EditTagHighlightSectionProps) {
  const tagData = event.tags.map(tag => tag.key);
  const tagColumnSize = Math.ceil(tagData.length / columnCount);
  const tagColumns: React.ReactNode[] = [];
  const highlightTagsSet = new Set(highlightTags);
  for (let i = 0; i < tagData.length; i += tagColumnSize) {
    tagColumns.push(
      <EditHighlightColumn key={`tag-column-${i}`}>
        {tagData.slice(i, i + tagColumnSize).map((tagKey, j) => {
          const isDisabled = highlightTagsSet.has(tagKey);
          return (
            <EditTagContainer key={`tag-${i}-${j}`}>
              <EditButton
                aria-label={`Add ${tagKey} tag to highlights`}
                icon={<IconAdd />}
                size="xs"
                onClick={() => onAddTag(tagKey)}
                disabled={isDisabled}
                title={isDisabled && t('Already highlighted')}
                tooltipProps={{delay: 500}}
              />
              <HighlightKey disabled={isDisabled} aria-disabled={isDisabled}>
                {tagKey}
              </HighlightKey>
            </EditTagContainer>
          );
        })}
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
  highlightContext: HighlightContext;
  onAddContextKey: (contextType: string, contextKey: string) => void;
}

function EditContextHighlightSection({
  columnCount,
  event,
  highlightContext,
  onAddContextKey,
}: EditContextHighlightSectionProps) {
  const ctxDisableMap: Record<string, Set<string>> = Object.entries(
    highlightContext
  ).reduce(
    (disableMap, [contextType, contextKeys]) => ({
      ...disableMap,
      [contextType]: new Set(contextKeys ?? []),
    }),
    {}
  );
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
      <EditHighlightColumn key={`ctx-column-${i}`}>
        {ctxItems.slice(i, i + ctxColumnSize).map(([contextType, contextKeys], j) => (
          <EditContextContainer key={`ctxv-item-${i}-${j}`}>
            <ContextType>{contextType}</ContextType>
            {contextKeys.map((contextKey, k) => {
              const isDisabled = ctxDisableMap[contextType]?.has(contextKey) ?? false;
              return (
                <Fragment key={`ctx-key-${i}-${j}-${k}`}>
                  <EditButton
                    aria-label={`Add ${contextKey} from ${contextType} context to highlights`}
                    icon={<IconAdd />}
                    size="xs"
                    onClick={() => onAddContextKey(contextType, contextKey)}
                    disabled={isDisabled}
                    title={isDisabled && t('Already highlighted')}
                    tooltipProps={{delay: 500}}
                  />
                  <HighlightKey disabled={isDisabled} aria-disabled={isDisabled}>
                    {contextKey}
                  </HighlightKey>
                </Fragment>
              );
            })}
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
  highlightContext: prevHighlightContext,
  highlightTags: prevHighlightTags,
  project,
  closeModal,
}: EditHighlightsModalProps) {
  const [highlightContext, setHighlightContext] =
    useState<HighlightContext>(prevHighlightContext);
  const [highlightTags, setHighlightTags] = useState<HighlightTags>(prevHighlightTags);

  const organization = useOrganization();
  const api = useApi();

  const {mutate: saveHighlights, isLoading} = useMutation<Project, RequestError>({
    mutationFn: () => {
      return api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
        method: 'PUT',
        data: {
          highlightContext,
          highlightTags,
        },
      });
    },
    onSuccess: (_updatedProject: Project) => {
      addSuccessMessage(
        tct(`Successfully updated highlights for '[projectName]' project`, {
          projectName: project.name,
        })
      );
      closeModal();
    },
    onError: _error => {
      addErrorMessage(
        tct(`Failed to update highlights for '[projectName]' project`, {
          projectName: project.name,
        })
      );
    },
  });

  const columnCount = 3;
  return (
    <Fragment>
      <Header>
        <Title>{t('Edit Event Highlights')}</Title>
      </Header>
      <Body>
        <EditPreviewHighlightSection
          event={event}
          highlightTags={highlightTags}
          highlightContext={highlightContext}
          onRemoveTag={tagKey =>
            setHighlightTags(highlightTags.filter(tag => tag !== tagKey))
          }
          onRemoveContextKey={(contextType, contextKey) =>
            setHighlightContext({
              ...highlightContext,
              [contextType]: (highlightContext[contextType] ?? []).filter(
                key => key !== contextKey
              ),
            })
          }
          project={project}
        />
        <EditTagHighlightSection
          event={event}
          columnCount={columnCount}
          highlightTags={highlightTags}
          onAddTag={tagKey => setHighlightTags([...highlightTags, tagKey])}
        />
        <EditContextHighlightSection
          event={event}
          columnCount={columnCount}
          highlightContext={highlightContext}
          onAddContextKey={(contextType, contextKey) =>
            setHighlightContext({
              ...highlightContext,
              [contextType]: [...(highlightContext[contextType] ?? []), contextKey],
            })
          }
        />
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button onClick={closeModal} size="sm">
            {t('Cancel')}
          </Button>
          <Button
            disabled={isLoading}
            onClick={() => saveHighlights()}
            priority="primary"
            size="sm"
          >
            {isLoading ? t('Saving...') : t('Save')}
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

const EditHighlightSection = styled('div')`
  margin-top: 25px;
`;

const EditHighlightSectionContent = styled('div')<{columnCount: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.columnCount}, minmax(0, 1fr));
`;

const EditHighlightColumn = styled('div')`
  grid-column: span 1;
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

const EditPreviewColumn = styled(EditHighlightColumn)`
  display: grid;
  grid-template-columns: 22px auto 1fr;
  column-gap: 0;
  button {
    margin-right: ${space(0.25)};
  }
`;

const EditPreviewContextItem = styled(ContextCardContent)`
  font-size: ${p => p.theme.fontSizeSmall};
  grid-column: span 2;
  .ctx-row-value {
    grid-column: span 1;
  }
  &:nth-child(4n-2) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const EditPreviewTagItem = styled(EventTagsTreeRow)`
  &:nth-child(4n-2) {
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
  color: ${p => (p.disabled ? p.theme.disabledBorder : p.theme.subText)};
  border-color: ${p => (p.disabled ? p.theme.disabledBorder : p.theme.border)};
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
  &:hover {
    color: ${p => (p.disabled ? p.theme.disabledBorder : p.theme.subText)};
  }
`;

const HighlightKey = styled('p')<{disabled?: boolean}>`
  grid-column: span 1;
  color: ${p => (p.disabled ? p.theme.disabledBorder : p.theme.subText)};
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
