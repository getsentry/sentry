import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {InputProps} from 'sentry/components/core/input';
import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {ContextCardContent} from 'sentry/components/events/contexts/contextCard';
import {getContextMeta} from 'sentry/components/events/contexts/utils';
import EventTagsTreeRow from 'sentry/components/events/eventTags/eventTagsTreeRow';
import type {
  HighlightContext,
  HighlightTags,
} from 'sentry/components/events/highlights/util';
import {
  getHighlightContextData,
  getHighlightTagData,
} from 'sentry/components/events/highlights/util';
import {InputGroup} from 'sentry/components/inputGroup';
import {IconAdd, IconInfo, IconSearch, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useMutateProject from 'sentry/utils/useMutateProject';
import useOrganization from 'sentry/utils/useOrganization';

export interface EditHighlightsModalProps extends ModalRenderProps {
  event: Event;
  highlightContext: HighlightContext;
  highlightTags: HighlightTags;
  project: Project;
  highlightPreset?: Project['highlightPreset'];
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
  ...props
}: EditPreviewHighlightSectionProps) {
  const organization = useOrganization();
  const location = useLocation();
  const previewColumnCount = 2;

  const highlightContextDataItems = getHighlightContextData({
    event,
    project,
    organization,
    highlightContext,
    location,
  });
  const highlightContextRows = highlightContextDataItems.reduce<React.ReactNode[]>(
    (rowList, {alias, data}) => {
      const meta = getContextMeta(event, alias);
      const newRows = data.map(item => (
        <Fragment key={`edit-highlight-ctx-${alias}-${item.key}`}>
          <EditButton
            aria-label={`Remove from highlights`}
            icon={<IconSubtract />}
            size="xs"
            onClick={() => onRemoveContextKey(alias, item.key)}
            data-test-id="highlights-remove-ctx"
          />
          <EditPreviewContextItem
            meta={meta}
            item={item}
            alias={alias}
            config={{
              includeAliasInSubject: true,
              disableErrors: true,
              disableLink: true,
            }}
            data-test-id="highlights-preview-ctx"
          />
        </Fragment>
      ));
      return [...rowList, ...newRows];
    },
    []
  );

  const highlightTagItems = getHighlightTagData({event, highlightTags});
  const highlightTagRows = highlightTagItems.map(content => (
    <Fragment key={`edit-highlight-tag-${content.originalTag.key}`}>
      <EditButton
        aria-label={`Remove from highlights`}
        icon={<IconSubtract />}
        size="xs"
        onClick={() => onRemoveTag(content.originalTag.key)}
        data-test-id="highlights-remove-tag"
      />
      <EditPreviewTagItem
        content={content}
        event={event}
        tagKey={content.originalTag.key}
        project={project}
        config={{disableActions: true, disableRichValue: true, disableErrors: true}}
        data-test-id="highlights-preview-tag"
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
    <EditHighlightPreview columnCount={previewColumnCount} {...props}>
      {columns.length > 0 ? (
        columns
      ) : (
        <EmptyHighlightMessage data-test-id="highlights-empty-preview">
          {t('Promote tags or context keys to highlights for quicker debugging!')}
        </EmptyHighlightMessage>
      )}
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
  ...props
}: EditTagHighlightSectionProps) {
  const [tagFilter, setTagFilter] = useState('');
  const tagData = event.tags
    .filter(tag => tag.key?.includes(tagFilter))
    .map(tag => tag.key);
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
              <HighlightKey
                disabled={isDisabled}
                aria-disabled={isDisabled}
                data-test-id="highlight-tag-option"
              >
                {tagKey}
              </HighlightKey>
            </EditTagContainer>
          );
        })}
      </EditHighlightColumn>
    );
  }
  return (
    <EditHighlightSection {...props}>
      <Subtitle>
        <SubtitleText>{t('Tags')}</SubtitleText>
        <SectionFilterInput
          placeholder={t('Search Tags')}
          value={tagFilter}
          onChange={e => setTagFilter(e.target.value)}
          data-test-id="highlights-tag-search"
        />
      </Subtitle>
      <EditHighlightSectionContent columnCount={columnCount}>
        {tagColumns.length > 0 ? (
          tagColumns
        ) : (
          <EmptyHighlightMessage extraMargin data-test-id="highlights-empty-tags">
            {t('No matching event tags found.')}
          </EmptyHighlightMessage>
        )}
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
  ...props
}: EditContextHighlightSectionProps) {
  const [ctxFilter, setCtxFilter] = useState('');
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
    (acc, {alias, value}) => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      acc[alias] = Object.keys(value).filter(k => k !== 'type');
      return acc;
    },
    {}
  );
  const ctxItems = Object.entries(ctxData);
  const filteredCtxItems = ctxItems
    .map<[string, string[]]>(([contextType, contextKeys]) => {
      const filteredContextKeys = contextKeys.filter(
        contextKey => contextKey.includes(ctxFilter) || contextType.includes(ctxFilter)
      );
      return [contextType, filteredContextKeys];
    })
    .filter(([_contextType, contextKeys]) => contextKeys.length !== 0);
  const ctxColumnSize = Math.ceil(filteredCtxItems.length / columnCount);
  const contextColumns: React.ReactNode[] = [];
  for (let i = 0; i < filteredCtxItems.length; i += ctxColumnSize) {
    contextColumns.push(
      <EditHighlightColumn key={`ctx-column-${i}`}>
        {filteredCtxItems
          .slice(i, i + ctxColumnSize)
          .map(([contextType, contextKeys], j) => {
            return (
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
                      <HighlightKey
                        disabled={isDisabled}
                        aria-disabled={isDisabled}
                        data-test-id="highlight-context-option"
                      >
                        {contextKey}
                      </HighlightKey>
                    </Fragment>
                  );
                })}
              </EditContextContainer>
            );
          })}
      </EditHighlightColumn>
    );
  }

  return (
    <EditHighlightSection {...props}>
      <Subtitle>
        <SubtitleText>{t('Context')}</SubtitleText>
        <SectionFilterInput
          placeholder={t('Search Context')}
          value={ctxFilter}
          onChange={e => setCtxFilter(e.target.value)}
          data-test-id="highlights-context-search"
        />
      </Subtitle>
      <EditHighlightSectionContent columnCount={columnCount}>
        {contextColumns.length > 0 ? (
          contextColumns
        ) : (
          <EmptyHighlightMessage extraMargin data-test-id="highlights-empty-context">
            {t('No matching event context found.')}
          </EmptyHighlightMessage>
        )}
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
  highlightPreset,
  project,
  closeModal,
}: EditHighlightsModalProps) {
  const [highlightContext, setHighlightContext] =
    useState<HighlightContext>(prevHighlightContext);
  const [highlightTags, setHighlightTags] = useState<HighlightTags>(prevHighlightTags);

  const organization = useOrganization();

  const {mutate: saveHighlights, isPending} = useMutateProject({
    organization,
    project,
    onSuccess: closeModal,
  });

  const columnCount = 3;
  return (
    <Fragment>
      <Header closeButton>
        <Title>{t('Edit Event Highlights')}</Title>
      </Header>
      <Body css={modalBodyCss}>
        <EditPreviewHighlightSection
          event={event}
          highlightTags={highlightTags}
          highlightContext={highlightContext}
          onRemoveTag={tagKey => {
            trackAnalytics('highlights.edit_modal.remove_tag', {organization});
            setHighlightTags(highlightTags.filter(tag => tag !== tagKey));
          }}
          onRemoveContextKey={(contextType, contextKey) => {
            trackAnalytics('highlights.edit_modal.remove_context_key', {organization});
            setHighlightContext(() => {
              const {[contextType]: highlightContextKeys, ...newHighlightContext} =
                highlightContext;
              const newHighlightContextKeys = (highlightContextKeys ?? []).filter(
                key => key !== contextKey
              );
              return newHighlightContextKeys.length === 0
                ? newHighlightContext
                : {
                    ...newHighlightContext,
                    [contextType]: newHighlightContextKeys,
                  };
            });
          }}
          project={project}
          data-test-id="highlights-preview-section"
        />
        <EditTagHighlightSection
          event={event}
          columnCount={columnCount}
          highlightTags={highlightTags}
          onAddTag={tagKey => {
            trackAnalytics('highlights.edit_modal.add_tag', {organization});
            setHighlightTags([...highlightTags, tagKey]);
          }}
          data-test-id="highlights-tag-section"
        />
        <EditContextHighlightSection
          event={event}
          columnCount={columnCount}
          highlightContext={highlightContext}
          onAddContextKey={(contextType, contextKey) => {
            trackAnalytics('highlights.edit_modal.add_context_key', {organization});
            setHighlightContext({
              ...highlightContext,
              [contextType]: [...(highlightContext[contextType] ?? []), contextKey],
            });
          }}
          data-test-id="highlights-context-section"
        />
      </Body>
      <Footer>
        <FooterInfo data-test-id="highlights-save-info">
          <IconInfo />
          <div>{t('Changes are applied to all issues for this project')}</div>
        </FooterInfo>
        <ButtonBar gap={1}>
          <Button
            onClick={() => {
              trackAnalytics('highlights.edit_modal.cancel_clicked', {organization});
              closeModal();
            }}
            size="sm"
          >
            {t('Cancel')}
          </Button>
          {highlightPreset && (
            <Button
              onClick={() => {
                trackAnalytics('highlights.edit_modal.use_default_clicked', {
                  organization,
                });
                setHighlightContext(highlightPreset.context);
                setHighlightTags(highlightPreset.tags);
              }}
              size="sm"
            >
              {t('Use Defaults')}
            </Button>
          )}
          <Button
            disabled={isPending}
            onClick={() => {
              trackAnalytics('highlights.edit_modal.save_clicked', {organization});
              saveHighlights({highlightContext, highlightTags});
            }}
            priority="primary"
            size="sm"
          >
            {isPending ? t('Saving...') : t('Apply to Project')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

function SectionFilterInput(props: InputProps) {
  return (
    <InputGroup>
      <InputGroup.LeadingItems disablePointerEvents>
        <IconSearch color="subText" size="xs" />
      </InputGroup.LeadingItems>
      <InputGroup.Input size="xs" autoComplete="off" {...props} />
    </InputGroup>
  );
}

const modalBodyCss = css`
  margin: 0 -${space(4)};
  padding: 0 ${space(4)};
  /* Full height minus enough buffer for header, footer and margins */
  max-height: calc(100vh - 275px);
  overflow-y: auto;
`;

const Title = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Subtitle = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  margin-bottom: ${space(1.5)};
  padding-bottom: ${space(0.5)};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SubtitleText = styled('h4')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: 0;
`;

const FooterInfo = styled('div')`
  flex: 1;
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
  gap: ${space(1)};
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

const EmptyHighlightMessage = styled('div')<{extraMargin?: boolean}>`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  grid-column: 1 / -1;
  text-align: center;
  margin: ${p => (p.extraMargin ? space(3) : 0)} 0;
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
  grid-template-columns: 22px minmax(auto, 175px) 1fr;
  column-gap: 0;
  button {
    margin-right: ${space(0.25)};
  }
`;

const EditPreviewContextItem = styled(ContextCardContent)`
  font-size: ${p => p.theme.fontSizeSmall};
  grid-column: span 2;
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
  font-weight: ${p => p.theme.fontWeightBold};
  text-transform: capitalize;
  margin-bottom: ${space(0.25)};
`;
