import {Link, withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';

import {HealthContextActions} from './propTypes';
import Header from './styles/header';
import withHealth from './util/withHealth';

class DetailContainer extends React.Component {
  static propTypes = {
    title: PropTypes.node,
    router: PropTypes.object,
    actions: HealthContextActions,
    specifiers: PropTypes.arrayOf(PropTypes.string),
  };

  render() {
    const {router, actions, specifiers, children, title} = this.props;
    // destructure `location` because we don't want to pass query string to breadcrumb
    // eslint-disable-next-line no-unused-vars
    const {location, ...routerWithoutQueryString} = router;
    const shouldShowDetails = specifiers && !!specifiers.length;

    return (
      <React.Fragment>
        <Header>
          {shouldShowDetails ? (
            <React.Fragment>
              <Link to={recreateRoute('', routerWithoutQueryString)}>{title}</Link>
              <Chevron /> {specifiers[0].split(':')[1]}
            </React.Fragment>
          ) : (
            title
          )}
        </Header>

        {children({
          shouldShowDetails,
          title,
          specifiers,
          setSpecifier: actions.setSpecifier,
        })}
      </React.Fragment>
    );
  }
}

export default withRouter(withHealth(DetailContainer));
export {DetailContainer};

const Chevron = styled(props => <InlineSvg src="icon-chevron-right" {...props} />)`
  height: 14px;
  width: 14px;
  margin: 0 ${space(0.5)};
`;
