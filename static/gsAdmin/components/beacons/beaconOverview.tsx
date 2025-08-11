import moment from 'moment-timezone';

import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsContainer from 'admin/components/detailsContainer';

export type BeaconData = {
  email: string;
  events24h: number;
  firstCheckin: string;
  id: string;
  installID: string;
  isDocker: boolean;
  lastCheckin: string;
  totalProjects: number;
  totalUsers: number;
  version: string;
};

type Props = {
  data: BeaconData;
};

function BeaconOverview({data}: Props) {
  return (
    <DetailsContainer>
      <DetailList>
        <DetailLabel title="Contact">
          {data.email ? <a href={`mailto:${data.email}`}>{data.email}</a> : 'n/a'}
        </DetailLabel>
        <DetailLabel title="Users">
          {data.totalUsers === null ? 'n/a' : data.totalUsers.toLocaleString()}
        </DetailLabel>
        <DetailLabel title="Projects">
          {data.totalProjects === null ? 'n/a' : data.totalProjects.toLocaleString()}
        </DetailLabel>
        <DetailLabel title="Events (24h)">
          {data.events24h === null ? 'n/a' : data.events24h.toLocaleString()}
        </DetailLabel>
        <DetailLabel title="Docker">
          {data.isDocker === true ? 'Yes' : data.isDocker === false ? 'No' : 'n/a'}
        </DetailLabel>
      </DetailList>
      <DetailList>
        <DetailLabel title="First Checkin">
          {moment(data.firstCheckin).fromNow()}
        </DetailLabel>
        <DetailLabel title="Last Checkin">
          {moment(data.lastCheckin).fromNow()}
        </DetailLabel>
        <DetailLabel title="Version">{data.version}</DetailLabel>
        <DetailLabel title="Install ID">{data.installID}</DetailLabel>
      </DetailList>
    </DetailsContainer>
  );
}

export default BeaconOverview;
