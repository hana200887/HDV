using MenuService.Models;
using Microsoft.EntityFrameworkCore;

namespace MenuService.Data;

public sealed class MenuDbContext(DbContextOptions<MenuDbContext> options) : DbContext(options)
{
    public DbSet<MenuItemEntity> MenuItems => Set<MenuItemEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<MenuItemEntity>(entity =>
        {
            entity.ToTable("menu_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.Price).HasColumnType("numeric(10,2)");
            entity.Property(x => x.CreatedAt);
        });
    }
}