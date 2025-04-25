import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Input} from 'sentry/components/core/input';
import {Switch} from 'sentry/components/core/switch';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useSetExplorePageParams} from 'sentry/views/explore/contexts/pageParamsContext';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';

type SingleQueryProps = {
  query: string;
  visualizes: BaseVisualize[];
  groupBys?: string[]; // This needs to be passed in because saveQuery relies on being within the Explore PageParamsContext to fetch params
};

export type SaveQueryModalProps = {
  organization: Organization;
  saveQuery: (name: string, starred?: boolean) => Promise<SavedQuery>;
  name?: string;
  source?: 'toolbar' | 'table';
};

type Props = ModalRenderProps & SaveQueryModalProps;

function SaveQueryModal({
  Header,
  Body,
  Footer,
  closeModal,
  saveQuery,
  name: initialName,
  source,
}: Props) {
  const organization = useOrganization();

  const [name, setName] = useState(initialName ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [starred, setStarred] = useState(true);

  const setExplorePageParams = useSetExplorePageParams();

  const updatePageIdAndTitle = useCallback(
    (id: string, title: string) => {
      setExplorePageParams({id, title});
    },
    [setExplorePageParams]
  );

  const onSave = useCallback(async () => {
    try {
      setIsSaving(true);
      addLoadingMessage(t('Saving query...'));
      const {id} = await saveQuery(name, initialName === undefined ? starred : undefined);
      if (initialName === undefined) {
        updatePageIdAndTitle(id, name);
      }
      addSuccessMessage(t('Query saved successfully'));
      if (defined(source)) {
        trackAnalytics('trace_explorer.save_query_modal', {
          action: 'submit',
          save_type: initialName === undefined ? 'save_new_query' : 'rename_query',
          ui_source: source,
          organization,
        });
      }
      closeModal();
    } catch (error) {
      addErrorMessage(t('Failed to save query'));
      Sentry.captureException(error);
    } finally {
      setIsSaving(false);
    }
  }, [
    saveQuery,
    name,
    starred,
    updatePageIdAndTitle,
    closeModal,
    organization,
    initialName,
    source,
  ]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{defined(initialName) ? t('Rename Query') : t('New Query')}</h4>
      </Header>
      <Body>
        <Wrapper>
          <SectionHeader>{t('Name')}</SectionHeader>
          <Input
            placeholder={
              defined(initialName)
                ? t('Enter a name for your query')
                : t('Enter a name for your new query')
            }
            onChange={e => setName(e.target.value)}
            value={name}
            title={
              defined(initialName)
                ? t('Enter a name for your query')
                : t('Enter a name for your new query')
            }
          />
        </Wrapper>
        {initialName === undefined && (
          <StarredWrapper>
            <Switch
              checked={starred}
              onChange={() => {
                setStarred(!starred);
              }}
              title={t('Starred')}
            />
            <SectionHeader>{t('Starred')}</SectionHeader>
          </StarredWrapper>
        )}
      </Body>

      <Footer>
        <StyledButtonBar gap={1.5}>
          <Button onClick={closeModal} disabled={isSaving}>
            {t('Cancel')}
          </Button>
          <Button onClick={onSave} disabled={!name || isSaving} priority="primary">
            {defined(initialName) ? t('Save Changes') : t('Create a New Query')}
          </Button>
        </StyledButtonBar>
      </Footer>
    </Fragment>
  );
}

export function ExploreParams({
  query,
  visualizes,
  groupBys,
  className,
}: SingleQueryProps & {className?: string}) {
  const yAxes = visualizes.flatMap(visualize => visualize.yAxes);

  return (
    <ExploreParamsContainer className={className}>
      <ExploreParamSection>
        <ExploreParamTitle>{t('Visualize')}</ExploreParamTitle>
        <ExploreParamSection>
          {yAxes.map(yAxis => (
            <ExploreVisualizes key={yAxis}>{yAxis}</ExploreVisualizes>
          ))}
        </ExploreParamSection>
      </ExploreParamSection>
      {query && (
        <ExploreParamSection>
          <ExploreParamTitle>{t('Filter')}</ExploreParamTitle>
          <FormattedQueryWrapper>
            <ProvidedFormattedQuery query={query} />
          </FormattedQueryWrapper>
        </ExploreParamSection>
      )}
      {groupBys && groupBys.length > 0 && (
        <ExploreParamSection>
          <ExploreParamTitle>{t('Group By')}</ExploreParamTitle>
          <ExploreParamSection>
            {groupBys.map(groupBy => (
              <ExploreGroupBys key={groupBy}>{groupBy}</ExploreGroupBys>
            ))}
          </ExploreParamSection>
        </ExploreParamSection>
      )}
    </ExploreParamsContainer>
  );
}

export default SaveQueryModal;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StarredWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;

  > h6 {
    margin-bottom: 0;
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (max-width: ${props => props.theme.breakpoints.small}) {
    grid-template-rows: repeat(2, 1fr);
    gap: ${space(1.5)};
    width: 100%;

    > button {
      width: 100%;
    }
  }
`;

const SectionHeader = styled('h6')`
  font-size: ${p => p.theme.form.md.fontSize};
  margin-bottom: ${space(0.5)};
`;

const ExploreParamsContainer = styled('span')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  flex-wrap: wrap;
  margin-bottom: ${space(2)};
`;

const ExploreParamSection = styled('span')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
  overflow: hidden;
  flex-wrap: wrap;
`;

const ExploreParamTitle = styled('span')`
  font-size: ${p => p.theme.form.sm.fontSize};
  color: ${p => p.theme.subText};
  white-space: nowrap;
  padding-top: 3px;
`;

const ExploreVisualizes = styled('span')`
  font-size: ${p => p.theme.form.sm.fontSize};
  background: ${p => p.theme.background};
  padding: ${space(0.25)} ${space(0.5)};
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  height: 24px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const ExploreGroupBys = ExploreVisualizes;

const FormattedQueryWrapper = styled('span')`
  display: inline-block;
`;
