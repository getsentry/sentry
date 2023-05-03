import {Location} from 'history';

import SpansTable from './spansTable';

type Props = {
  location: Location;
};

export default function SpansView(props: Props) {
  return <SpansTable location={props.location} />;
}
