import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {IconAdd, IconDelete, IconGrabbable} from 'app/icons';
import {SectionHeading} from 'app/components/charts/styles';
import {t} from 'app/locale';
import space from 'app/styles/space';
import SelectField from 'app/views/settings/components/forms/selectField';

import {Section} from './types';

export const SECTIONS: Record<string, Section> = {
  issueList: {kind: 'issueList', name: 'Issue List'},
  alerts: {kind: 'alerts', name: 'Alerts'},
  discover: {kind: 'discover', name: 'Discover'},
  keyTransactions: {kind: 'keyTransactions', name: 'Key Transactions'},
};

type Props = ModalRenderProps & {
  sections: Section[];
  onApply: (sections: Section[]) => void;
};

type State = {
  sections: Section[] | null;
};

class SectionEditModal extends React.Component<Props, State> {
  state = {
    sections: null,
  };

  static getDerivedStateFromProps({sections}: Props, state: State) {
    if (state.sections === null) {
      return {
        sections: [...sections],
      };
    }

    return state;
  }

  handleChange = (key, i) => {
    const {sections} = this.state;
    this.setState({
      sections: (sections ?? []).map((section, idx) => {
        if (idx === i) {
          return SECTIONS[key];
        }
        return section;
      }),
    });
  };

  handleApply = () => {
    const {closeModal, onApply} = this.props;
    const {sections} = this.state;
    onApply(sections ?? []);
    closeModal();
  };

  handleRemoveSection = i => {
    const {sections} = this.state;
    const newSections = [...(sections ?? [])];
    newSections.splice(i, 1);
    this.setState({
      sections: newSections,
    });
  };

  handleAddSection = () => {
    const {sections} = this.state;
    this.setState({
      sections: [...(sections ?? []), SECTIONS.issueList],
    });
  };

  renderItem(section: Section, i: number) {
    return (
      <React.Fragment>
        <RowContainer>
          <Button
            aria-label={t('Drag to reorder')}
            onMouseDown={_ => {
              /*this.startDrag(event, i)*/
            }}
            icon={<IconGrabbable size="xs" color="gray700" />}
            size="zero"
            borderless
          />
          <StyledSelectField
            name="section"
            value={section.kind}
            choices={Object.values(SECTIONS).map(({kind, name}) => [kind, name])}
            onChange={event => this.handleChange(event, i)}
          />
          <Button
            aria-label={t('Remove column')}
            onClick={() => this.handleRemoveSection(i)}
            icon={<IconDelete color="gray500" />}
            borderless
          />
        </RowContainer>
      </React.Fragment>
    );
  }

  render() {
    const {Header, Body, Footer} = this.props;
    const {sections} = this.state;

    return (
      <React.Fragment>
        <Header>
          <h4>{t('Edit Sections')}</h4>
        </Header>
        <Body>
          <RowContainer>
            <Heading gridColumns={1}>
              <StyledSectionHeading>{t('Section')}</StyledSectionHeading>
            </Heading>
          </RowContainer>
          {(sections ?? []).map((section: Section, i: number) =>
            this.renderItem(section, i)
          )}
          <RowContainer>
            <Actions>
              <Button
                size="small"
                label={t('Add a Column')}
                onClick={this.handleAddSection}
                icon={<IconAdd isCircled size="xs" />}
              >
                {t('Add a Column')}
              </Button>
            </Actions>
          </RowContainer>
        </Body>
        <Footer>
          <Button label={t('Apply')} priority="primary" onClick={this.handleApply}>
            {t('Apply')}
          </Button>
        </Footer>
      </React.Fragment>
    );
  }
}

const RowContainer = styled('div')`
  display: grid;
  grid-template-columns: 24px auto 24px;
  align-items: center;
  width: 100%;
  padding-bottom: ${space(1)};
`;

const Heading = styled('div')<{gridColumns: number}>`
  grid-column: 2 / 3;

  /* Emulate the grid used in the column editor rows */
  display: grid;
  grid-template-columns: repeat(${p => p.gridColumns}, 1fr);
  grid-column-gap: ${space(1)};
`;

const StyledSectionHeading = styled(SectionHeading)`
  margin: 0;
`;

const StyledSelectField = styled(SelectField)`
  padding: 0;
  border: none;

  /* Hack to make the select field bigger */
  width: 200%;
`;

const Actions = styled('div')`
  grid-column: 2 / 3;
`;

const modalCss = css``;

export default SectionEditModal;
export {modalCss};
