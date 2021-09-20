import {Location} from 'history';

import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';

type Props = {
  location: Location;
  organization: Organization;
  eventView: EventView;
};

function SpansContent(_props: Props) {
  return <p>spans</p>;
}

export default SpansContent;
