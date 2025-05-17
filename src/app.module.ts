import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from './Messaging/messaging.module';
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      database: 'tp3websocket',
      //autoloadEntities: true,
      synchronize: true,
      username: 'root',
      password: '',
    }),
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
