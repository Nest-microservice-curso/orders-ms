import { IsEnum, IsUUID } from 'class-validator';
import { OrderStatusList } from './enum/ordes.enum';
import { OrderStatus } from '@prisma/client';

export class StatusOrderDto {
  @IsEnum(OrderStatusList, {
    message: `status must be a valid enum value: ${OrderStatusList}`,
  })
  status: OrderStatus;

  @IsUUID()
  id: string;
}
