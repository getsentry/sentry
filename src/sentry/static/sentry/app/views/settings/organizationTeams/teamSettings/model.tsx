import {updateTeam} from 'app/actionCreators/teams';
import FormModel from 'app/views/settings/components/forms/model';

class TeamFormModel extends FormModel {
  public orgId: string;
  public teamId: string;

  constructor(orgId: string, teamId: string) {
    super();
    this.orgId = orgId;
    this.teamId = teamId;
  }

  doApiRequest({data}) {
    return new Promise((resolve, reject) =>
      updateTeam(
        this.api,
        {
          orgId: this.orgId,
          teamId: this.teamId,
          data,
        },
        {
          success: resolve,
          error: reject,
        }
      )
    );
  }
}

export default TeamFormModel;
