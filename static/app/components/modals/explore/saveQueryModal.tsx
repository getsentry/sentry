import {Fragment, useCallback, useState} from 'react';
import {css} from '@emotion/react';
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
import {FormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useSetExplorePageParams} from 'sentry/views/explore/contexts/pageParamsContext';
import type {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';

export type SaveQueryModalProps = {
  organization: Organization;
  query: string;
  saveQuery: (name: string) => Promise<SavedQuery>;
  visualizes: Visualize[];
  groupBys?: string[]; // This needs to be passed in because saveQuery relies on being within the Explore PageParamsContext to fetch params
};

type Props = ModalRenderProps & SaveQueryModalProps;

function SaveQueryModal({
  Header,
  Body,
  Footer,
  closeModal,
  groupBys,
  query,
  visualizes,
  saveQuery,
}: Props) {
  const yAxes = visualizes.flatMap(visualize => visualize.yAxes);

  const organization = useOrganization();

  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
      const {id} = await saveQuery(name);
      updatePageIdAndTitle(id, name);
      addSuccessMessage(t('Query saved successfully'));
      trackAnalytics('trace_explorer.save_as', {
        save_type: 'saved_query',
        ui_source: 'toolbar',
        organization,
      });
      closeModal();
    } catch (error) {
      addErrorMessage(t('Failed to save query'));
      Sentry.captureException(error);
    } finally {
      setIsSaving(false);
    }
  }, [saveQuery, name, updatePageIdAndTitle, closeModal, organization]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('New Query')}</h4>
      </Header>
      <Body>
        <Wrapper>
          <SectionHeader>{t('Name')}</SectionHeader>
          <Input
            placeholder={t('Enter a name for your saved query')}
            onChange={e => setName(e.target.value)}
            value={name}
            title={t('Enter a name for your saved query')}
          />
        </Wrapper>
        <Wrapper>
          <SectionHeader>{t('Query')}</SectionHeader>
          <ExploreParamsContainer>
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
                  <FormattedQuery query={query} />
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
            <ExploreParamSection>...</ExploreParamSection>
          </ExploreParamsContainer>
        </Wrapper>
      </Body>

      <Footer>
        <StyledButtonBar gap={1.5}>
          <Button onClick={closeModal} disabled={isSaving}>
            {t('Cancel')}
          </Button>
          <Button onClick={onSave} disabled={!name || isSaving} priority="primary">
            {t('Create a New Query')}
          </Button>
        </StyledButtonBar>
      </Footer>
    </Fragment>
  );
}

export default SaveQueryModal;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
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

export const modalCss = css`
  max-width: 700px;
  margin: 70px auto;
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
  color: ${p => p.theme.gray300};
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
