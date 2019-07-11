import PropTypes from 'prop-types';
import React, {Suspense} from 'react';
import styled from 'react-emotion';

const DropdownAutoCompleteMenu = React.lazy(() =>
  import(/* webpackChunkName: "DropdownAutoCompleteMenu" */ './menu')
);

class DropdownAutoComplete extends React.Component {
  static propTypes = {
    // Should clicking the actor toggle visibility?
    allowActorToggle: PropTypes.bool,

    children: PropTypes.func,
  };

  static defaultProps = {
    alignMenu: 'right',
  };

  render() {
    const {children, allowActorToggle, ...props} = this.props;

    const FallbackActor = (
      <Actor role="button" isDropdownDisabled>
        {children({
          getActorProps: () => ({
            isDropdownDisabled: true,
          }),
        })}
      </Actor>
    );

    return (
      <Suspense fallback={FallbackActor}>
        <DropdownAutoCompleteMenu {...props}>
          {renderProps => {
            // Don't pass `onClick` from `getActorProps`
            const {
              //eslint-disable-next-line no-unused-vars
              onClick,
              ...actorProps
            } = renderProps.getActorProps({isStyled: true});

            return (
              <Actor
                isOpen={renderProps.isOpen}
                role="button"
                onClick={
                  renderProps.isOpen && allowActorToggle
                    ? renderProps.actions.close
                    : renderProps.actions.open
                }
                {...actorProps}
              >
                {children(renderProps)}
              </Actor>
            );
          }}
        </DropdownAutoCompleteMenu>
      </Suspense>
    );
  }
}

const Actor = styled('div')`
  position: relative;
  width: 100%;
  /* This is needed to be able to cover dropdown menu so that it looks like one unit */
  ${p => p.isOpen && `z-index: ${p.theme.zIndex.dropdownAutocomplete.actor}`};
`;

export default DropdownAutoComplete;
