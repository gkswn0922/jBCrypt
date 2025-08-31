module.exports = {
    apps: [
      {
        name: "joytel",                           // 프로세스 이름
        script: "npm",                            // npm 명령어 실행
        args: "run start -- --host 0.0.0.0",      // 운영 모드 실행
        cwd: "/home/ubuntu/jBCrypt/joytel-express", // 실행 경로 (프로젝트 폴더)
        interpreter: "none",                      // pm2가 node 대신 npm 실행
        env: {
          NODE_ENV: "production"                  // 환경변수: 운영모드
        }
      }
    ]
  }