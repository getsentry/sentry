import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Button from '../buttons/button';
import {t} from '../../locale';
import {markUseful, nextStep} from '../../actionCreators/guides';
import CueIcon from './cueIcon';
import CloseIcon from './closeIcon';
import AssistantContainer from './assistantContainer';

// GuideDrawer is what slides up when the user clicks on a guide cue.
export default class GuideDrawer extends React.Component {
  static propTypes = {
    guide: PropTypes.object.isRequired,
    step: PropTypes.number.isRequired,
    onFinish: PropTypes.func.isRequired,
    onDismiss: PropTypes.func.isRequired,
  };

  handleUseful = useful => {
    markUseful(this.props.guide.id, useful);
    this.props.onFinish();
  };

  render() {
    return (
      <StyledAssistantContainer>
        <StyledAssistantInputRow>
          <CueIcon hasGuide={true} />
          <StyledTitle>{this.props.guide.steps[this.props.step - 1].title}</StyledTitle>
          <div
            className="close-button"
            style={{display: 'flex'}}
            onClick={this.props.onDismiss}
          >
            <CloseIcon />
          </div>
        </StyledAssistantInputRow>
        <StyledContent>
          <div
            dangerouslySetInnerHTML={{
              __html: this.props.guide.steps[this.props.step - 1].message,
            }}
          />
          <div style={{marginTop: '1em'}}>
            {this.props.step < this.props.guide.steps.length ? (
              <div>
                <Button priority="success" size="small" onClick={nextStep}>
                  {t('Next')} &rarr;
                </Button>
              </div>
            ) : (
              <div>
                <p>{t('Did you find this guide useful?')}</p>
                <Button
                  priority="success"
                  size="small"
                  onClick={() => this.handleUseful(true)}
                >
                  {t('Yes')} &nbsp; &#x2714;
                </Button>
                <Button
                  priority="success"
                  size="small"
                  style={{marginLeft: '0.25em'}}
                  onClick={() => this.handleUseful(false)}
                >
                  {t('No')} &nbsp; &#x2716;
                </Button>
              </div>
            )}
          </div>
        </StyledContent>
      </StyledAssistantContainer>
    );
  }
}

const StyledAssistantContainer = styled(AssistantContainer)`
  background-color: ${p => p.theme.greenDark};
  border-color: ${p => p.theme.greenLight};
  color: ${p => p.theme.offWhite};
  height: auto;
`;

const StyledAssistantInputRow = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledTitle = styled('div')`
  font-size: 1.5em;
  margin-left: 0.5em;
  flex-grow: 1;
`;

const StyledContent = styled('div')`
  margin: 1.5rem;
  line-height: 1.5;
`;
