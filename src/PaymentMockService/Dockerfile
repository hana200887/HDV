FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/PaymentMockService/PaymentMockService.csproj", "src/PaymentMockService/"]
COPY ["src/SharedContracts/SharedContracts.csproj", "src/SharedContracts/"]
RUN dotnet restore "src/PaymentMockService/PaymentMockService.csproj"
COPY . .
WORKDIR "/src/src/PaymentMockService"
RUN dotnet publish "PaymentMockService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "PaymentMockService.dll"]