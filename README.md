<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

## access secret google project

`gcloud projects add-iam-policy-binding  <YOUR_PROJECT_ID> --member='serviceAccount:99999999@cloudbuild.gserviceaccount.com' --role='roles/secretmanager.secretAccessor'`
