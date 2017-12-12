import {updateTeam} from '../../../actionCreators/teams';
import FormModel from '../components/forms/model';

class TeamFormModel extends FormModel {
  doApiRequest({data}) {
    return updateTeam(this.api, {
      orgId: this.orgId,
      teamId: this.teamId,
      data,
    });
  }
}

export default TeamFormModel;
