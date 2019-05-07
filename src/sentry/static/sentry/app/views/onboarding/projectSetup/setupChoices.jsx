import {fromPairs} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import posed from 'react-pose';
import styled, {css} from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

const HOVER_TIMEOUT = 100;
const POSITIONS = ['top', 'bottom', 'left', 'right'];

const itemsShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  subtext: PropTypes.string.isRequired,
  extra: PropTypes.node,
});

/**
 * Visually fancy choice-card component with an animated hover effect that
 * follows the focused choice. Uses react-pose to handle animations of the
 * background element by passing the computed rect
 */
class SetupChoices extends React.Component {
  static propTypes = {
    choices: PropTypes.arrayOf(itemsShape),
    selectedChoice: PropTypes.string,
    onSelect: PropTypes.func,
  };

  state = {
    hoveTarget: null,
    pressed: false,
  };

  componentDidMount() {
    this.setHoverTarget(this.props.selectedChoice);
  }

  hoverTimeout = null;
  containerRef = React.createRef();
  itemRefs = {};

  setHoverTarget(hoverTarget) {
    clearTimeout(this.hoverTimeout);
    this.hoverTimeout = setTimeout(() => this.setState({hoverTarget}), HOVER_TIMEOUT);
  }

  computeRect = element => {
    const targetRect = element.getClientRects()[0];
    const containerRect = this.containerRef.current.getClientRects()[0];

    return fromPairs(POSITIONS.map(k => [k, Math.abs(targetRect[k] - containerRect[k])]));
  };

  getAnimationProps = id => ({
    onMouseEnter: e => this.setHoverTarget(id),
    onMouseLeave: e => this.setHoverTarget(this.props.selectedChoice),
    onPressStart: e => this.setState({pressed: true}),
    onPressEnd: e => this.setState({pressed: false}),
  });

  render() {
    const {choices, selectedChoice, onSelect} = this.props;
    const {pressed, hoverTarget} = this.state;

    return (
      <ChoicesGrid innerRef={this.containerRef}>
        {choices.map(({id, title, icon, subtext, extra}) => (
          <Choice
            key={id}
            innerRef={el => (this.itemRefs[id] = el)}
            onClick={e => onSelect(id)}
            selected={id === selectedChoice}
            focused={id === hoverTarget}
            {...this.getAnimationProps(id)}
          >
            <ChoiceTitle>
              <InlineSvg size="20" src={icon} />
              {title}
            </ChoiceTitle>
            <ChoiceDescription>{subtext}</ChoiceDescription>
            {extra}
          </Choice>
        ))}
        <FocusedShadow
          pose={pressed ? 'pressed' : 'focused'}
          poseKey={hoverTarget + selectedChoice}
          rect={hoverTarget ? this.computeRect(this.itemRefs[hoverTarget]) : {}}
        />
      </ChoicesGrid>
    );
  }
}

const hoverTransition = {
  type: 'spring',
  stiffness: 500,
  damping: 25,
  mass: 0.5,
};

const position = fromPairs(POSITIONS.map(k => [k, ({rect}) => rect[k]]));

const PosedFocusShadow = posed.div({
  focused: {
    ...position,
    scale: 1,
    transition: hoverTransition,
  },
  pressed: {
    scale: 1.05,
    transition: {duration: 80},
  },
});

const FocusedShadow = styled(PosedFocusShadow)`
  position: absolute;
  z-index: -1;
  background: ${p => p.theme.gray5};
  box-shadow: 0 2px 0 rgba(54, 45, 89, 0.15);
  border-radius: 5px;
`;

const ChoicesGrid = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
  position: relative;
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: ${space(2)};
`;

const ChoiceTitle = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  grid-gap: ${space(1)};
  font-weight: bold;
  margin-bottom: ${space(1)};
`;

const ChoiceDescription = styled('div')`
  font-size: 1.4rem;
  line-height: 2rem;
  color: ${p => p.theme.gray3};
`;

const focusedChoiceStyles = css`
  color: #fff;
  /* stylelint-disable-next-line no-duplicate-selectors */
  ${ChoiceDescription} {
    color: #fff;
  }
`;

const Choice = styled(posed.div({pressable: true}))`
  cursor: pointer;
  padding: 8px 10px;
  transition: color 150ms;
  position: relative;
  ${p => p.focused && focusedChoiceStyles}
`;

export default SetupChoices;
