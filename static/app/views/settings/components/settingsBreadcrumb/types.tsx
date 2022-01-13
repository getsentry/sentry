import {RouteProps} from 'react-router';

// TODO(ts): The `name` attribute doesn't appear on any of the react router route types

export interface RouteWithName extends RouteProps {
  name?: string;
}
